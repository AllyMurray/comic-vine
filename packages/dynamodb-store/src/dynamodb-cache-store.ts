import type { CacheStore } from '@comic-vine/client';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  DynamoDBStoreConfigSchema,
  StoreDestroyedError,
  type DynamoDBStoreOptions,
  type DynamoDBStoreConfig,
  type DynamoDBClientWrapper,
} from './types.js';
import { createDynamoDBClient, destroyDynamoDBClient } from './client.js';
import {
  buildCacheKey,
  buildExpirationGSI1Key,
  TableAttributes,
  EntityTypes,
  type CacheItem,
} from './schema.js';
import {
  calculateTTL,
  isExpired,
  serializeValue,
  deserializeValue,
  retryWithBackoff,
  chunkArray,
  MAX_ITEM_SIZE_BYTES,
} from './utils.js';

export interface DynamoDBCacheStoreOptions extends DynamoDBStoreOptions {}

export class DynamoDBCacheStore<T = unknown> implements CacheStore<T> {
  private readonly config: DynamoDBStoreConfig;
  private readonly clientWrapper: DynamoDBClientWrapper;
  private readonly docClient: DynamoDBDocumentClient;
  private cleanupInterval?: NodeJS.Timeout;
  private isDestroyed = false;

  constructor(options: DynamoDBCacheStoreOptions = {}) {
    this.config = DynamoDBStoreConfigSchema.parse(options);
    this.clientWrapper = createDynamoDBClient(this.config);
    this.docClient = DynamoDBDocumentClient.from(this.clientWrapper.client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    this.startCleanupInterval();
  }

  async get(hash: string): Promise<T | undefined> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const key = buildCacheKey(hash);

        const command = new GetCommand({
          TableName: this.config.tableName,
          Key: key,
          ProjectionExpression: `${TableAttributes.TTL}, ${TableAttributes.Data}`,
        });

        const result = await this.docClient.send(command);

        if (!result.Item) {
          return undefined;
        }

        const item = result.Item as Pick<CacheItem, 'TTL' | 'Data'>;

        // Check if item has expired
        if (isExpired(item.TTL)) {
          // Delete expired item asynchronously
          this.delete(hash).catch(() => {
            // Ignore deletion errors for expired items
          });
          return undefined;
        }

        return deserializeValue<T>(item.Data.value as string);
      },
      this.config,
      'cache.get',
    );
  }

  async set(hash: string, value: T, ttlSeconds: number): Promise<void> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const serializedValue = serializeValue(value);
        const ttl = calculateTTL(ttlSeconds);
        const now = Date.now();

        const key = buildCacheKey(hash);
        const gsi1Key = buildExpirationGSI1Key(EntityTypes.CACHE, ttl, key.PK);

        const item: CacheItem = {
          ...key,
          ...gsi1Key,
          TTL: ttl,
          Data: {
            value: serializedValue,
            createdAt: now,
          },
        };

        const command = new PutCommand({
          TableName: this.config.tableName,
          Item: item,
        });

        await this.docClient.send(command);
      },
      this.config,
      'cache.set',
    );
  }

  async delete(hash: string): Promise<void> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const key = buildCacheKey(hash);

        const command = new DeleteCommand({
          TableName: this.config.tableName,
          Key: key,
        });

        await this.docClient.send(command);
      },
      this.config,
      'cache.delete',
    );
  }

  async clear(): Promise<void> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        let lastEvaluatedKey: Record<string, unknown> | undefined;

        do {
          // Scan for all cache items
          const scanCommand = new ScanCommand({
            TableName: this.config.tableName,
            FilterExpression: 'begins_with(#pk, :cachePrefix)',
            ExpressionAttributeNames: {
              '#pk': TableAttributes.PK,
            },
            ExpressionAttributeValues: {
              ':cachePrefix': `${EntityTypes.CACHE}#`,
            },
            ProjectionExpression: `${TableAttributes.PK}, ${TableAttributes.SK}`,
            ExclusiveStartKey: lastEvaluatedKey,
          });

          const scanResult = await this.docClient.send(scanCommand);

          if (scanResult.Items && scanResult.Items.length > 0) {
            // Delete items in batches
            const chunks = chunkArray(scanResult.Items, this.config.batchSize);

            for (const chunk of chunks) {
              const deleteRequests = chunk.map((item) => ({
                DeleteRequest: {
                  Key: {
                    [TableAttributes.PK]: item[TableAttributes.PK],
                    [TableAttributes.SK]: item[TableAttributes.SK],
                  },
                },
              }));

              const batchCommand = new BatchWriteCommand({
                RequestItems: {
                  [this.config.tableName]: deleteRequests,
                },
              });

              await this.docClient.send(batchCommand);
            }
          }

          lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);
      },
      this.config,
      'cache.clear',
    );
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalItems: number;
    expiredItems: number;
    estimatedSizeBytes: number;
  }> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        let totalItems = 0;
        let expiredItems = 0;
        let estimatedSizeBytes = 0;
        let lastEvaluatedKey: Record<string, unknown> | undefined;
        const now = Math.floor(Date.now() / 1000);

        do {
          const scanCommand = new ScanCommand({
            TableName: this.config.tableName,
            FilterExpression: 'begins_with(#pk, :cachePrefix)',
            ExpressionAttributeNames: {
              '#pk': TableAttributes.PK,
            },
            ExpressionAttributeValues: {
              ':cachePrefix': `${EntityTypes.CACHE}#`,
            },
            ProjectionExpression: `${TableAttributes.TTL}, ${TableAttributes.Data}`,
            ExclusiveStartKey: lastEvaluatedKey,
          });

          const result = await this.docClient.send(scanCommand);

          if (result.Items) {
            for (const item of result.Items) {
              totalItems++;

              if (item.TTL && item.TTL <= now) {
                expiredItems++;
              }

              // Estimate size (rough approximation)
              if (item.Data?.value) {
                estimatedSizeBytes += Buffer.byteLength(
                  typeof item.Data.value === 'string'
                    ? item.Data.value
                    : JSON.stringify(item.Data.value),
                  'utf8',
                );
              }
            }
          }

          lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return {
          totalItems,
          expiredItems,
          estimatedSizeBytes,
        };
      },
      this.config,
      'cache.getStats',
    );
  }

  /**
   * Manually trigger cleanup of expired items
   */
  async cleanup(): Promise<number> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        let deletedCount = 0;
        let lastEvaluatedKey: Record<string, unknown> | undefined;
        const now = Math.floor(Date.now() / 1000);

        do {
          // Scan for expired cache items
          const scanCommand = new ScanCommand({
            TableName: this.config.tableName,
            FilterExpression: 'begins_with(#pk, :cachePrefix) AND #ttl <= :now',
            ExpressionAttributeNames: {
              '#pk': TableAttributes.PK,
              '#ttl': TableAttributes.TTL,
            },
            ExpressionAttributeValues: {
              ':cachePrefix': `${EntityTypes.CACHE}#`,
              ':now': now,
            },
            ProjectionExpression: `${TableAttributes.PK}, ${TableAttributes.SK}`,
            ExclusiveStartKey: lastEvaluatedKey,
          });

          const scanResult = await this.docClient.send(scanCommand);

          if (scanResult.Items && scanResult.Items.length > 0) {
            // Delete expired items in batches
            const chunks = chunkArray(scanResult.Items, this.config.batchSize);

            for (const chunk of chunks) {
              const deleteRequests = chunk.map((item) => ({
                DeleteRequest: {
                  Key: {
                    [TableAttributes.PK]: item[TableAttributes.PK],
                    [TableAttributes.SK]: item[TableAttributes.SK],
                  },
                },
              }));

              const batchCommand = new BatchWriteCommand({
                RequestItems: {
                  [this.config.tableName]: deleteRequests,
                },
              });

              await this.docClient.send(batchCommand);
              deletedCount += chunk.length;
            }
          }

          lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return deletedCount;
      },
      this.config,
      'cache.cleanup',
    );
  }

  /**
   * Close the store and cleanup resources
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.isDestroyed = true;
    destroyDynamoDBClient(this.clientWrapper);
  }

  /**
   * Alias for close() to match test expectations
   */
  destroy(): void {
    this.close();
  }

  private ensureNotDestroyed(): void {
    if (this.isDestroyed) {
      throw new StoreDestroyedError('DynamoDBCacheStore');
    }
  }

  private startCleanupInterval(): void {
    if (this.config.cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(async () => {
        try {
          await this.cleanup();
        } catch (error) {
          // Log error but don't crash the application
          console.warn('DynamoDBCacheStore cleanup failed:', error);
        }
      }, this.config.cleanupIntervalMs);

      // Don't keep the process alive just for cleanup
      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }
}
