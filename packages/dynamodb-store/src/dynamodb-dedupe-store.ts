import { randomUUID } from 'node:crypto';
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { DedupeStore } from '@comic-vine/client';
import { createDynamoDBClient, destroyDynamoDBClient } from './client.js';
import {
  buildDedupeKey,
  buildExpirationGSI1Key,
  TableAttributes,
  EntityTypes,
  extractJobIdFromDedupeKey,
  type DedupeItem,
} from './schema.js';
import {
  DynamoDBStoreConfigSchema,
  StoreDestroyedError,
  type DynamoDBStoreOptions,
  type DynamoDBStoreConfig,
  type DynamoDBClientWrapper,
} from './types.js';
import {
  calculateTTL,
  isExpired,
  serializeValue,
  deserializeValue,
  retryWithBackoff,
  chunkArray,
  sleep,
  isConditionalCheckFailedError,
  DEFAULT_DEDUPE_TTL_SECONDS,
} from './utils.js';

export interface DynamoDBDedupeStoreOptions extends DynamoDBStoreOptions {
  /**
   * Default TTL for dedupe jobs in seconds
   * @default 300 (5 minutes)
   */
  defaultTtlSeconds?: number;

  /**
   * Maximum wait time for waitFor() in milliseconds
   * @default 30000 (30 seconds)
   */
  maxWaitTimeMs?: number;

  /**
   * Poll interval for waitFor() in milliseconds
   * @default 100 (100ms)
   */
  pollIntervalMs?: number;
}

export class DynamoDBDedupeStore<T = unknown> implements DedupeStore<T> {
  private readonly config: DynamoDBStoreConfig;
  private readonly clientWrapper: DynamoDBClientWrapper;
  private readonly docClient: DynamoDBDocumentClient;
  private readonly defaultTtlSeconds: number;
  private readonly maxWaitTimeMs: number;
  private readonly pollIntervalMs: number;
  private cleanupInterval?: NodeJS.Timeout;
  private isDestroyed = false;

  constructor(options: DynamoDBDedupeStoreOptions = {}) {
    this.config = DynamoDBStoreConfigSchema.parse(options);
    this.clientWrapper = createDynamoDBClient(this.config);
    this.docClient = DynamoDBDocumentClient.from(this.clientWrapper.client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    this.defaultTtlSeconds =
      options.defaultTtlSeconds ?? DEFAULT_DEDUPE_TTL_SECONDS;
    this.maxWaitTimeMs = options.maxWaitTimeMs ?? 30000;
    this.pollIntervalMs = options.pollIntervalMs ?? 100;

    this.startCleanupInterval();
  }

  async waitFor(hash: string): Promise<T | undefined> {
    this.ensureNotDestroyed();

    const startTime = Date.now();

    while (Date.now() - startTime < this.maxWaitTimeMs) {
      const result = await this.checkJobStatus(hash);

      if (!result) {
        // No job found, caller should register one
        return undefined;
      }

      if (result.status === 'completed') {
        return result.result;
      }

      if (result.status === 'failed') {
        throw new Error(result.error || 'Job failed without error message');
      }

      // Job is still pending, wait and poll again
      await sleep(this.pollIntervalMs);
    }

    // Timeout reached
    throw new Error(
      `Timed out waiting for job completion after ${this.maxWaitTimeMs}ms`,
    );
  }

  async register(hash: string): Promise<string> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const jobId = randomUUID();
        const ttl = calculateTTL(this.defaultTtlSeconds);
        const now = Date.now();

        const key = buildDedupeKey(hash, jobId);
        const gsi1Key = buildExpirationGSI1Key(EntityTypes.DEDUPE, ttl, key.PK);

        const item: DedupeItem = {
          ...key,
          ...gsi1Key,
          TTL: ttl,
          Data: {
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          },
        };

        // Use conditional put to ensure we don't overwrite existing jobs
        // Check that no job with the same hash exists (regardless of jobId)
        const command = new PutCommand({
          TableName: this.config.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(#pk)',
          ExpressionAttributeNames: {
            '#pk': TableAttributes.PK,
          },
        });

        try {
          await this.docClient.send(command);
          return jobId;
        } catch (error) {
          if (isConditionalCheckFailedError(error)) {
            // Another job is already registered for this hash
            // Check if it's still valid (not expired) and still pending
            const existingJob = await this.getExistingJob(hash);
            if (
              existingJob &&
              !isExpired(existingJob.TTL) &&
              existingJob.Data.status === 'pending'
            ) {
              throw new Error(`Job already in progress for hash: ${hash}`);
            }

            // Existing job is expired, try again
            throw error; // Will be retried by retryWithBackoff
          }
          throw error;
        }
      },
      this.config,
      'dedupe.register',
    );
  }

  async complete(hash: string, value: T): Promise<void> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const serializedValue = serializeValue(value);
        const now = Date.now();

        // Find the job for this hash
        const existingJob = await this.getExistingJob(hash);
        if (!existingJob) {
          throw new Error(`No job found for hash: ${hash}`);
        }

        if (isExpired(existingJob.TTL)) {
          throw new Error(`Job for hash ${hash} has expired`);
        }

        const jobId = extractJobIdFromDedupeKey(existingJob.SK);
        const key = buildDedupeKey(hash, jobId);

        const command = new UpdateCommand({
          TableName: this.config.tableName,
          Key: key,
          UpdateExpression:
            'SET #data.#status = :status, #data.#result = :result, #data.#updatedAt = :updatedAt',
          ConditionExpression: '#data.#status = :pendingStatus',
          ExpressionAttributeNames: {
            '#data': TableAttributes.Data,
            '#status': 'status',
            '#result': 'result',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': 'completed',
            ':result': serializedValue,
            ':updatedAt': now,
            ':pendingStatus': 'pending',
          },
        });

        try {
          await this.docClient.send(command);
        } catch (error) {
          if (isConditionalCheckFailedError(error)) {
            throw new Error(`Job for hash ${hash} is not in pending status`);
          }
          throw error;
        }
      },
      this.config,
      'dedupe.complete',
    );
  }

  async fail(hash: string, error: Error): Promise<void> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const now = Date.now();

        // Find the job for this hash
        const existingJob = await this.getExistingJob(hash);
        if (!existingJob) {
          throw new Error(`No job found for hash: ${hash}`);
        }

        if (isExpired(existingJob.TTL)) {
          throw new Error(`Job for hash ${hash} has expired`);
        }

        const jobId = extractJobIdFromDedupeKey(existingJob.SK);
        const key = buildDedupeKey(hash, jobId);

        const command = new UpdateCommand({
          TableName: this.config.tableName,
          Key: key,
          UpdateExpression:
            'SET #data.#status = :status, #data.#error = :error, #data.#updatedAt = :updatedAt',
          ConditionExpression: '#data.#status = :pendingStatus',
          ExpressionAttributeNames: {
            '#data': TableAttributes.Data,
            '#status': 'status',
            '#error': 'error',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': 'failed',
            ':error': error.message,
            ':updatedAt': now,
            ':pendingStatus': 'pending',
          },
        });

        try {
          await this.docClient.send(command);
        } catch (err) {
          if (isConditionalCheckFailedError(err)) {
            throw new Error(`Job for hash ${hash} is not in pending status`);
          }
          throw err;
        }
      },
      this.config,
      'dedupe.fail',
    );
  }

  async isInProgress(hash: string): Promise<boolean> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const result = await this.checkJobStatus(hash);
        return result?.status === 'pending' || false;
      },
      this.config,
      'dedupe.isInProgress',
    );
  }

  /**
   * Get dedupe statistics
   */
  async getStats(): Promise<{
    totalJobs: number;
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    expiredJobs: number;
  }> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        let totalJobs = 0;
        let pendingJobs = 0;
        let completedJobs = 0;
        let failedJobs = 0;
        let expiredJobs = 0;
        let lastEvaluatedKey: Record<string, unknown> | undefined;
        const now = Math.floor(Date.now() / 1000);

        do {
          const scanCommand = new ScanCommand({
            TableName: this.config.tableName,
            FilterExpression: 'begins_with(#pk, :dedupePrefix)',
            ExpressionAttributeNames: {
              '#pk': TableAttributes.PK,
            },
            ExpressionAttributeValues: {
              ':dedupePrefix': `${EntityTypes.DEDUPE}#`,
            },
            ProjectionExpression: `${TableAttributes.TTL}, ${TableAttributes.Data}`,
            ExclusiveStartKey: lastEvaluatedKey,
          });

          const result = await this.docClient.send(scanCommand);

          if (result.Items) {
            for (const item of result.Items) {
              totalJobs++;

              if (item.TTL && item.TTL <= now) {
                expiredJobs++;
                continue;
              }

              const status = item.Data?.status;
              switch (status) {
                case 'pending':
                  pendingJobs++;
                  break;
                case 'completed':
                  completedJobs++;
                  break;
                case 'failed':
                  failedJobs++;
                  break;
              }
            }
          }

          lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return {
          totalJobs,
          pendingJobs,
          completedJobs,
          failedJobs,
          expiredJobs,
        };
      },
      this.config,
      'dedupe.getStats',
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
          // Scan for expired dedupe items
          const scanCommand = new ScanCommand({
            TableName: this.config.tableName,
            FilterExpression:
              'begins_with(#pk, :dedupePrefix) AND #ttl <= :now',
            ExpressionAttributeNames: {
              '#pk': TableAttributes.PK,
              '#ttl': TableAttributes.TTL,
            },
            ExpressionAttributeValues: {
              ':dedupePrefix': `${EntityTypes.DEDUPE}#`,
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
      'dedupe.cleanup',
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
      throw new StoreDestroyedError('DynamoDBDedupeStore');
    }
  }

  private async checkJobStatus(hash: string): Promise<
    | {
        status: 'pending' | 'completed' | 'failed';
        result?: T;
        error?: string;
      }
    | undefined
  > {
    // Query for any job with this hash
    const queryCommand = new QueryCommand({
      TableName: this.config.tableName,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: {
        '#pk': TableAttributes.PK,
      },
      ExpressionAttributeValues: {
        ':pk': `${EntityTypes.DEDUPE}#${hash}`,
      },
      ProjectionExpression: `${TableAttributes.SK}, ${TableAttributes.TTL}, ${TableAttributes.Data}`,
      Limit: 1, // Should only be one job per hash
    });

    const result = await this.docClient.send(queryCommand);

    if (!result.Items || result.Items.length === 0) {
      return undefined;
    }

    const item = result.Items[0] as Pick<DedupeItem, 'SK' | 'TTL' | 'Data'>;

    // Check if item has expired
    if (isExpired(item.TTL)) {
      return undefined;
    }

    const jobData = item.Data;

    if (jobData.status === 'completed' && jobData.result !== undefined) {
      return {
        status: 'completed',
        result: deserializeValue<T>(jobData.result as string),
      };
    }

    if (jobData.status === 'failed') {
      return {
        status: 'failed',
        error: jobData.error,
      };
    }

    return {
      status: 'pending',
    };
  }

  private async getExistingJob(hash: string): Promise<DedupeItem | undefined> {
    const queryCommand = new QueryCommand({
      TableName: this.config.tableName,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: {
        '#pk': TableAttributes.PK,
      },
      ExpressionAttributeValues: {
        ':pk': `${EntityTypes.DEDUPE}#${hash}`,
      },
      Limit: 1,
    });

    const result = await this.docClient.send(queryCommand);

    if (!result.Items || result.Items.length === 0) {
      return undefined;
    }

    return result.Items[0] as DedupeItem;
  }

  private startCleanupInterval(): void {
    if (this.config.cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(async () => {
        try {
          await this.cleanup();
        } catch (error) {
          // Log error but don't crash the application
          console.warn('DynamoDBDedupeStore cleanup failed:', error);
        }
      }, this.config.cleanupIntervalMs);

      // Don't keep the process alive just for cleanup
      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }
}
