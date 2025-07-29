import { randomUUID } from 'node:crypto';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { RateLimitStore, RateLimitConfig } from '@comic-vine/client';
import { chunkArray } from './batch-operations.js';
import { createDynamoDBClient, destroyDynamoDBClient } from './client.js';
import {
  buildRateLimitKey,
  buildExpirationGSI1Key,
  TableAttributes,
  EntityTypes,
  extractResourceFromRateLimitKey,
  extractTimestampAndUuidFromRateLimitKey,
  type RateLimitItem,
} from './schema.js';
import { calculateTTL } from './ttl.js';
import {
  DynamoDBStoreConfigSchema,
  StoreDestroyedError,
  type DynamoDBStoreOptions,
  type DynamoDBStoreConfig,
  type DynamoDBClientWrapper,
} from './types.js';

export interface DynamoDBRateLimitStoreOptions extends DynamoDBStoreOptions {
  /**
   * Default rate limit configuration
   */
  defaultConfig?: RateLimitConfig;

  /**
   * Per-resource rate limit configurations
   */
  resourceConfigs?: Map<string, RateLimitConfig>;
}

export class DynamoDBRateLimitStore implements RateLimitStore {
  private readonly config: DynamoDBStoreConfig;
  private readonly clientWrapper: DynamoDBClientWrapper;
  private readonly docClient: DynamoDBDocumentClient;
  private defaultConfig: RateLimitConfig;
  private resourceConfigs = new Map<string, RateLimitConfig>();
  private cleanupInterval?: NodeJS.Timeout;
  private isDestroyed = false;

  constructor(options: DynamoDBRateLimitStoreOptions = {}) {
    this.config = DynamoDBStoreConfigSchema.parse(options);
    this.clientWrapper = createDynamoDBClient(this.config);
    this.docClient = DynamoDBDocumentClient.from(this.clientWrapper.client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    this.defaultConfig = options.defaultConfig ?? {
      limit: 200,
      windowMs: 60 * 1000, // 60 seconds in milliseconds
    };
    this.resourceConfigs = options.resourceConfigs ?? new Map();

    this.startCleanupInterval();
  }

  async canProceed(resource: string): Promise<boolean> {
    this.ensureNotDestroyed();

    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const currentCount = await this.getCurrentRequestCount(resource);
    return currentCount < config.limit;
  }

  async record(resource: string): Promise<void> {
    this.ensureNotDestroyed();

    const now = Date.now();
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const timestamp = Math.floor(now / 1000); // Use seconds for timestamp
    const uuid = randomUUID();
    const ttl = calculateTTL(Math.floor(config.windowMs / 1000) * 2); // Keep records for 2x window for safety

    const key = buildRateLimitKey(resource, timestamp, uuid);
    const gsi1Key = buildExpirationGSI1Key(EntityTypes.RATELIMIT, ttl, key.PK);

    const item: RateLimitItem = {
      ...key,
      ...gsi1Key,
      TTL: ttl,
      Data: {
        createdAt: now,
      },
    };

    const command = new PutCommand({
      TableName: this.config.tableName,
      Item: item,
    });

    await this.docClient.send(command);
  }

  async getStatus(resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
  }> {
    this.ensureNotDestroyed();

    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const currentCount = await this.getCurrentRequestCount(resource);
    const remaining = Math.max(0, config.limit - currentCount);

    // Calculate when the current window resets
    const now = Date.now();
    const windowSeconds = Math.floor(config.windowMs / 1000);
    const currentWindowStart =
      Math.floor(now / 1000 / windowSeconds) * windowSeconds;
    const nextWindowStart = currentWindowStart + windowSeconds;
    const resetTime = new Date(nextWindowStart * 1000);

    return {
      remaining,
      resetTime,
      limit: config.limit,
    };
  }

  async reset(resource: string): Promise<void> {
    this.ensureNotDestroyed();

    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      // Query for all rate limit records for this resource
      const queryCommand = new QueryCommand({
        TableName: this.config.tableName,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: {
          '#pk': TableAttributes.PK,
        },
        ExpressionAttributeValues: {
          ':pk': `${EntityTypes.RATELIMIT}#${resource}`,
        },
        ProjectionExpression: `${TableAttributes.PK}, ${TableAttributes.SK}`,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const queryResult = await this.docClient.send(queryCommand);

      if (queryResult.Items && queryResult.Items.length > 0) {
        // Delete items in batches
        const chunks = chunkArray(queryResult.Items, this.config.batchSize);

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

      lastEvaluatedKey = queryResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }

  async getWaitTime(resource: string): Promise<number> {
    this.ensureNotDestroyed();

    const canProceed = await this.canProceed(resource);

    if (canProceed) {
      return 0;
    }

    // Calculate time until the current window resets
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const now = Date.now();
    const windowSeconds = Math.floor(config.windowMs / 1000);
    const currentWindowStart =
      Math.floor(now / 1000 / windowSeconds) * windowSeconds;
    const nextWindowStart = currentWindowStart + windowSeconds;
    const waitTimeMs = nextWindowStart * 1000 - now;

    return Math.max(0, waitTimeMs);
  }

  /**
   * Get rate limiting statistics
   */
  async getStats(): Promise<{
    totalResources: number;
    activeResources: number;
    rateLimitedResources: number;
    totalRequests: number;
  }> {
    this.ensureNotDestroyed();

    const resourceMap = new Map<
      string,
      {
        requestCount: number;
        oldestTimestamp: number;
        newestTimestamp: number;
      }
    >();

    let lastEvaluatedKey: Record<string, unknown> | undefined;
    let totalRequests = 0;

    do {
      const scanCommand = new ScanCommand({
        TableName: this.config.tableName,
        FilterExpression: 'begins_with(#pk, :rateLimitPrefix)',
        ExpressionAttributeNames: {
          '#pk': TableAttributes.PK,
        },
        ExpressionAttributeValues: {
          ':rateLimitPrefix': `${EntityTypes.RATELIMIT}#`,
        },
        ProjectionExpression: `${TableAttributes.PK}, ${TableAttributes.SK}, ${TableAttributes.Data}`,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const result = await this.docClient.send(scanCommand);

      if (result.Items) {
        for (const item of result.Items) {
          totalRequests++;

          const resource = extractResourceFromRateLimitKey(
            item[TableAttributes.PK] as string,
          );
          const { timestamp } = extractTimestampAndUuidFromRateLimitKey(
            item[TableAttributes.SK] as string,
          );

          const existing = resourceMap.get(resource);
          if (existing) {
            existing.requestCount++;
            existing.oldestTimestamp = Math.min(
              existing.oldestTimestamp,
              timestamp,
            );
            existing.newestTimestamp = Math.max(
              existing.newestTimestamp,
              timestamp,
            );
          } else {
            resourceMap.set(resource, {
              requestCount: 1,
              oldestTimestamp: timestamp,
              newestTimestamp: timestamp,
            });
          }
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // Calculate active and rate-limited resources
    let activeResources = 0;
    let rateLimitedResources = 0;

    for (const [resource, stats] of resourceMap.entries()) {
      if (stats.requestCount > 0) {
        activeResources++;
        const config = this.resourceConfigs.get(resource) || this.defaultConfig;
        if (stats.requestCount >= config.limit) {
          rateLimitedResources++;
        }
      }
    }

    return {
      totalResources: resourceMap.size,
      activeResources,
      rateLimitedResources,
      totalRequests,
    };
  }

  /**
   * Manually trigger cleanup of expired items
   */
  async cleanup(): Promise<number> {
    this.ensureNotDestroyed();

    let deletedCount = 0;
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    const now = Math.floor(Date.now() / 1000);

    do {
      // Scan for expired rate limit items
      const scanCommand = new ScanCommand({
        TableName: this.config.tableName,
        FilterExpression: 'begins_with(#pk, :rateLimitPrefix) AND #ttl <= :now',
        ExpressionAttributeNames: {
          '#pk': TableAttributes.PK,
          '#ttl': TableAttributes.TTL,
        },
        ExpressionAttributeValues: {
          ':rateLimitPrefix': `${EntityTypes.RATELIMIT}#`,
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

  /**
   * Set rate limit configuration for a specific resource
   */
  setResourceConfig(resource: string, config: RateLimitConfig): void {
    this.resourceConfigs.set(resource, config);
  }

  /**
   * Get rate limit configuration for a resource
   */
  getResourceConfig(resource: string): RateLimitConfig {
    return this.resourceConfigs.get(resource) || this.defaultConfig;
  }

  private ensureNotDestroyed(): void {
    if (this.isDestroyed) {
      throw new StoreDestroyedError('DynamoDBRateLimitStore');
    }
  }

  private async getCurrentRequestCount(resource: string): Promise<number> {
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const now = Math.floor(Date.now() / 1000);
    const windowSeconds = Math.floor(config.windowMs / 1000);
    const windowStart = Math.floor(now / windowSeconds) * windowSeconds;

    // Query for requests in the current window
    const queryCommand = new QueryCommand({
      TableName: this.config.tableName,
      KeyConditionExpression: '#pk = :pk AND #sk >= :windowStart',
      ExpressionAttributeNames: {
        '#pk': TableAttributes.PK,
        '#sk': TableAttributes.SK,
      },
      ExpressionAttributeValues: {
        ':pk': `${EntityTypes.RATELIMIT}#${resource}`,
        ':windowStart': `REQ#${windowStart}#`,
      },
      Select: 'COUNT',
    });

    const result = await this.docClient.send(queryCommand);
    return result.Count ?? 0;
  }

  private startCleanupInterval(): void {
    if (this.config.cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(async () => {
        try {
          await this.cleanup();
        } catch (error) {
          // Log error but don't crash the application
          console.warn('DynamoDBRateLimitStore cleanup failed:', error);
        }
      }, this.config.cleanupIntervalMs);

      // Don't keep the process alive just for cleanup
      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }
}
