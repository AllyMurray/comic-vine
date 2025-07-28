import { randomUUID } from 'node:crypto';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  AdaptiveRateLimitStore,
  RequestPriority,
  AdaptiveConfig,
} from '@comic-vine/client';
import { createDynamoDBClient, destroyDynamoDBClient } from './client.js';
import {
  buildRateLimitKey,
  buildAdaptiveMetaKey,
  buildExpirationGSI1Key,
  TableAttributes,
  EntityTypes,
  extractResourceFromRateLimitKey,
  type RateLimitItem,
  type AdaptiveMetaItem,
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
  retryWithBackoff,
  chunkArray,
  isConditionalCheckFailedError,
} from './utils.js';

export interface DynamoDBAdaptiveRateLimitStoreOptions
  extends DynamoDBStoreOptions {
  /**
   * Default rate limit per resource (requests per minute)
   * @default 200
   */
  defaultLimit?: number;

  /**
   * Default rate limit window in seconds
   * @default 60 (1 minute)
   */
  defaultWindowSeconds?: number;

  /**
   * Adaptive rate limiting configuration
   */
  adaptiveConfig?: Partial<AdaptiveConfig>;
}

export class DynamoDBAdaptiveRateLimitStore implements AdaptiveRateLimitStore {
  private readonly config: DynamoDBStoreConfig;
  private readonly clientWrapper: DynamoDBClientWrapper;
  private readonly docClient: DynamoDBDocumentClient;
  private readonly defaultLimit: number;
  private readonly defaultWindowSeconds: number;
  private readonly adaptiveConfig: AdaptiveConfig;
  private cleanupInterval?: NodeJS.Timeout;
  private recalculationInterval?: NodeJS.Timeout;
  private isDestroyed = false;

  constructor(options: DynamoDBAdaptiveRateLimitStoreOptions = {}) {
    this.config = DynamoDBStoreConfigSchema.parse(options);
    this.clientWrapper = createDynamoDBClient(this.config);
    this.docClient = DynamoDBDocumentClient.from(this.clientWrapper.client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    this.defaultLimit = options.defaultLimit ?? 200;
    this.defaultWindowSeconds = options.defaultWindowSeconds ?? 60;

    // Default adaptive configuration
    this.adaptiveConfig = {
      monitoringWindowMs: 15 * 60 * 1000, // 15 minutes
      highActivityThreshold: 10,
      moderateActivityThreshold: 3,
      recalculationIntervalMs: 30000, // 30 seconds
      sustainedInactivityThresholdMs: 30 * 60 * 1000, // 30 minutes
      backgroundPauseOnIncreasingTrend: true,
      maxUserScaling: 2.0,
      minUserReserved: 5,
      ...options.adaptiveConfig,
    };

    this.startCleanupInterval();
    this.startRecalculationInterval();
  }

  async canProceed(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<boolean> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const [currentCount, metadata] = await Promise.all([
          this.getCurrentRequestCount(resource, priority),
          this.getOrCreateMetadata(resource),
        ]);

        const allocation = this.calculateAllocation(metadata);
        const limit =
          priority === 'user' ? allocation.userMax : allocation.backgroundMax;

        // Check if background requests are paused
        if (priority === 'background' && allocation.backgroundPaused) {
          return false;
        }

        return currentCount < limit;
      },
      this.config,
      'adaptiveRateLimit.canProceed',
    );
  }

  async record(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<void> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const now = Date.now();
        const timestamp = Math.floor(now / 1000);
        const uuid = randomUUID();
        const ttl = calculateTTL(this.defaultWindowSeconds * 2);

        const key = buildRateLimitKey(resource, timestamp, uuid);
        const gsi1Key = buildExpirationGSI1Key(
          EntityTypes.RATELIMIT,
          ttl,
          key.PK,
        );

        const item: RateLimitItem = {
          ...key,
          ...gsi1Key,
          TTL: ttl,
          Data: {
            priority,
            createdAt: now,
          },
        };

        const command = new PutCommand({
          TableName: this.config.tableName,
          Item: item,
        });

        await this.docClient.send(command);

        // Update metadata counters
        await this.updateMetadataCounters(resource, priority);
      },
      this.config,
      'adaptiveRateLimit.record',
    );
  }

  async getStatus(resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
    adaptive?: {
      userReserved: number;
      backgroundMax: number;
      backgroundPaused: boolean;
      recentUserActivity: number;
      reason: string;
    };
  }> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const [userCount, backgroundCount, metadata] = await Promise.all([
          this.getCurrentRequestCount(resource, 'user'),
          this.getCurrentRequestCount(resource, 'background'),
          this.getOrCreateMetadata(resource),
        ]);

        const allocation = this.calculateAllocation(metadata);
        const totalUsed = userCount + backgroundCount;
        const remaining = Math.max(0, this.defaultLimit - totalUsed);

        // Calculate reset time
        const now = Date.now();
        const currentWindowStart =
          Math.floor(now / 1000 / this.defaultWindowSeconds) *
          this.defaultWindowSeconds;
        const nextWindowStart = currentWindowStart + this.defaultWindowSeconds;
        const resetTime = new Date(nextWindowStart * 1000);

        return {
          remaining,
          resetTime,
          limit: this.defaultLimit,
          adaptive: {
            userReserved: allocation.userReserved,
            backgroundMax: allocation.backgroundMax,
            backgroundPaused: allocation.backgroundPaused,
            recentUserActivity: metadata.Data.userRequestCount,
            reason: metadata.Data.reason,
          },
        };
      },
      this.config,
      'adaptiveRateLimit.getStatus',
    );
  }

  async reset(resource: string): Promise<void> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
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

        // Reset metadata as well
        await this.resetMetadata(resource);
      },
      this.config,
      'adaptiveRateLimit.reset',
    );
  }

  async getWaitTime(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<number> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const canProceed = await this.canProceed(resource, priority);

        if (canProceed) {
          return 0;
        }

        // For background requests that are paused, return a longer wait time
        const metadata = await this.getOrCreateMetadata(resource);
        const allocation = this.calculateAllocation(metadata);

        if (priority === 'background' && allocation.backgroundPaused) {
          // Wait until next recalculation
          return this.adaptiveConfig.recalculationIntervalMs;
        }

        // Calculate time until the current window resets
        const now = Date.now();
        const currentWindowStart =
          Math.floor(now / 1000 / this.defaultWindowSeconds) *
          this.defaultWindowSeconds;
        const nextWindowStart = currentWindowStart + this.defaultWindowSeconds;
        const waitTimeMs = nextWindowStart * 1000 - now;

        return Math.max(0, waitTimeMs);
      },
      this.config,
      'adaptiveRateLimit.getWaitTime',
    );
  }

  /**
   * Get adaptive rate limiting statistics
   */
  async getStats(): Promise<{
    totalResources: number;
    totalRequests: number;
    userRequests: number;
    backgroundRequests: number;
    resourceStats: Record<
      string,
      {
        requestCount: number;
        userRequests: number;
        backgroundRequests: number;
        allocation: {
          userReserved: number;
          backgroundMax: number;
          backgroundPaused: boolean;
          activityLevel: 'low' | 'moderate' | 'high';
          reason: string;
        };
      }
    >;
  }> {
    this.ensureNotDestroyed();

    return retryWithBackoff(
      async () => {
        const resourceMap = new Map<
          string,
          {
            totalRequests: number;
            userRequests: number;
            backgroundRequests: number;
          }
        >();

        let lastEvaluatedKey: Record<string, unknown> | undefined;
        let totalRequests = 0;
        let userRequests = 0;
        let backgroundRequests = 0;

        // Scan rate limit records
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
            ProjectionExpression: `${TableAttributes.PK}, ${TableAttributes.Data}`,
            ExclusiveStartKey: lastEvaluatedKey,
          });

          const result = await this.docClient.send(scanCommand);

          if (result.Items) {
            for (const item of result.Items) {
              totalRequests++;

              const resource = extractResourceFromRateLimitKey(
                item[TableAttributes.PK] as string,
              );
              const priority =
                (item[TableAttributes.Data]?.priority as RequestPriority) ||
                'background';

              if (priority === 'user') {
                userRequests++;
              } else {
                backgroundRequests++;
              }

              const existing = resourceMap.get(resource);
              if (existing) {
                existing.totalRequests++;
                if (priority === 'user') {
                  existing.userRequests++;
                } else {
                  existing.backgroundRequests++;
                }
              } else {
                resourceMap.set(resource, {
                  totalRequests: 1,
                  userRequests: priority === 'user' ? 1 : 0,
                  backgroundRequests: priority === 'background' ? 1 : 0,
                });
              }
            }
          }

          lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        // Get allocation info for each resource
        const resourceStats: Record<
          string,
          {
            requestCount: number;
            userRequests: number;
            backgroundRequests: number;
            allocation: {
              userReserved: number;
              backgroundMax: number;
              backgroundPaused: boolean;
              activityLevel: 'low' | 'moderate' | 'high';
              reason: string;
            };
          }
        > = {};

        for (const [resource, stats] of resourceMap.entries()) {
          const metadata = await this.getOrCreateMetadata(resource);
          const allocation = this.calculateAllocation(metadata);

          resourceStats[resource] = {
            requestCount: stats.totalRequests,
            userRequests: stats.userRequests,
            backgroundRequests: stats.backgroundRequests,
            allocation: {
              userReserved: allocation.userReserved,
              backgroundMax: allocation.backgroundMax,
              backgroundPaused: allocation.backgroundPaused,
              activityLevel: metadata.Data.activityLevel,
              reason: metadata.Data.reason,
            },
          };
        }

        return {
          totalResources: resourceMap.size,
          totalRequests,
          userRequests,
          backgroundRequests,
          resourceStats,
        };
      },
      this.config,
      'adaptiveRateLimit.getStats',
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
          // Scan for expired rate limit items
          const scanCommand = new ScanCommand({
            TableName: this.config.tableName,
            FilterExpression:
              'begins_with(#pk, :rateLimitPrefix) AND #ttl <= :now',
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
      },
      this.config,
      'adaptiveRateLimit.cleanup',
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

    if (this.recalculationInterval) {
      clearInterval(this.recalculationInterval);
      this.recalculationInterval = undefined;
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
      throw new StoreDestroyedError('DynamoDBAdaptiveRateLimitStore');
    }
  }

  private async getCurrentRequestCount(
    resource: string,
    priority?: RequestPriority,
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart =
      Math.floor(now / this.defaultWindowSeconds) * this.defaultWindowSeconds;

    const expressionAttributeValues: Record<string, unknown> = {
      ':pk': `${EntityTypes.RATELIMIT}#${resource}`,
      ':windowStart': `REQ#${windowStart}#`,
    };

    if (priority) {
      expressionAttributeValues[':priority'] = priority;
    }

    const queryCommand = new QueryCommand({
      TableName: this.config.tableName,
      KeyConditionExpression: '#pk = :pk AND #sk >= :windowStart',
      FilterExpression: priority ? '#data.#priority = :priority' : undefined,
      ExpressionAttributeNames: {
        '#pk': TableAttributes.PK,
        '#sk': TableAttributes.SK,
        ...(priority && {
          '#data': TableAttributes.Data,
          '#priority': 'priority',
        }),
      },
      ExpressionAttributeValues: expressionAttributeValues,
      Select: 'COUNT',
    });

    const result = await this.docClient.send(queryCommand);
    return result.Count ?? 0;
  }

  private async getOrCreateMetadata(
    resource: string,
  ): Promise<AdaptiveMetaItem> {
    const key = buildAdaptiveMetaKey(resource);

    const getCommand = new GetCommand({
      TableName: this.config.tableName,
      Key: key,
    });

    const result = await this.docClient.send(getCommand);

    if (result.Item) {
      return result.Item as AdaptiveMetaItem;
    }

    // Create initial metadata
    const now = Date.now();
    const metadata: AdaptiveMetaItem = {
      ...key,
      Data: {
        userRequestCount: 0,
        backgroundRequestCount: 0,
        lastCalculation: now,
        backgroundPaused: false,
        activityLevel: 'low',
        reason: 'Initial state - low activity detected',
      },
    };

    const putCommand = new PutCommand({
      TableName: this.config.tableName,
      Item: metadata,
      ConditionExpression: 'attribute_not_exists(#pk)',
      ExpressionAttributeNames: {
        '#pk': TableAttributes.PK,
      },
    });

    try {
      await this.docClient.send(putCommand);
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        // Another process created it, fetch it
        const retryResult = await this.docClient.send(getCommand);
        if (retryResult.Item) {
          return retryResult.Item as AdaptiveMetaItem;
        }
      }
      throw error;
    }

    return metadata;
  }

  private async updateMetadataCounters(
    resource: string,
    priority: RequestPriority,
  ): Promise<void> {
    const key = buildAdaptiveMetaKey(resource);
    const counterField =
      priority === 'user' ? 'userRequestCount' : 'backgroundRequestCount';

    const updateCommand = new UpdateCommand({
      TableName: this.config.tableName,
      Key: key,
      UpdateExpression: 'ADD #data.#counter :inc',
      ExpressionAttributeNames: {
        '#data': TableAttributes.Data,
        '#counter': counterField,
      },
      ExpressionAttributeValues: {
        ':inc': 1,
      },
    });

    await this.docClient.send(updateCommand);
  }

  private calculateAllocation(metadata: AdaptiveMetaItem): {
    userReserved: number;
    userMax: number;
    backgroundMax: number;
    backgroundPaused: boolean;
  } {
    const {
      userRequestCount,
      backgroundRequestCount: _backgroundRequestCount,
      activityLevel,
      backgroundPaused,
    } = metadata.Data;

    // Calculate user allocation based on recent activity
    let userReserved = this.adaptiveConfig.minUserReserved;
    let userMax = this.defaultLimit;

    if (activityLevel === 'high') {
      userReserved = Math.min(
        this.defaultLimit * this.adaptiveConfig.maxUserScaling,
        this.defaultLimit * 0.8, // Never let user take more than 80%
      );
      userMax = userReserved;
    } else if (activityLevel === 'moderate') {
      userReserved = Math.min(
        this.defaultLimit * 0.3,
        this.adaptiveConfig.minUserReserved + userRequestCount * 2,
      );
      userMax = this.defaultLimit * 0.6;
    }

    const backgroundMax = Math.max(0, this.defaultLimit - userReserved);

    return {
      userReserved,
      userMax,
      backgroundMax,
      backgroundPaused,
    };
  }

  private async resetMetadata(resource: string): Promise<void> {
    const key = buildAdaptiveMetaKey(resource);
    const now = Date.now();

    const updateCommand = new UpdateCommand({
      TableName: this.config.tableName,
      Key: key,
      UpdateExpression: 'SET #data = :resetData',
      ExpressionAttributeNames: {
        '#data': TableAttributes.Data,
      },
      ExpressionAttributeValues: {
        ':resetData': {
          userRequestCount: 0,
          backgroundRequestCount: 0,
          lastCalculation: now,
          backgroundPaused: false,
          activityLevel: 'low' as const,
          reason: 'Manually reset',
        },
      },
    });

    await this.docClient.send(updateCommand);
  }

  private async recalculateAllocations(): Promise<void> {
    try {
      // This would scan for all adaptive metadata and recalculate allocations
      // For simplicity, this is a placeholder - in a real implementation,
      // you'd want to implement this based on your specific needs
      const now = Date.now();

      // Scan for all adaptive metadata
      let lastEvaluatedKey: Record<string, unknown> | undefined;

      do {
        const scanCommand = new ScanCommand({
          TableName: this.config.tableName,
          FilterExpression: 'begins_with(#pk, :adaptivePrefix)',
          ExpressionAttributeNames: {
            '#pk': TableAttributes.PK,
          },
          ExpressionAttributeValues: {
            ':adaptivePrefix': `${EntityTypes.ADAPTIVE}#`,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        });

        const result = await this.docClient.send(scanCommand);

        if (result.Items) {
          for (const item of result.Items) {
            const metadata = item as AdaptiveMetaItem;
            await this.recalculateResourceAllocation(metadata, now);
          }
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    } catch (error) {
      console.warn(
        'DynamoDBAdaptiveRateLimitStore recalculation failed:',
        error,
      );
    }
  }

  private async recalculateResourceAllocation(
    metadata: AdaptiveMetaItem,
    now: number,
  ): Promise<void> {
    const { userRequestCount, backgroundRequestCount, lastCalculation } =
      metadata.Data;
    const _timeSinceLastCalc = now - lastCalculation;

    // Determine activity level based on request counts
    let activityLevel: 'low' | 'moderate' | 'high' = 'low';
    let reason = 'Low activity detected';
    let backgroundPaused = false;

    const totalActivity = userRequestCount + backgroundRequestCount;

    if (totalActivity >= this.adaptiveConfig.highActivityThreshold) {
      activityLevel = 'high';
      reason = `High activity: ${totalActivity} requests in monitoring window`;
      backgroundPaused =
        this.adaptiveConfig.backgroundPauseOnIncreasingTrend &&
        userRequestCount > 0;
    } else if (totalActivity >= this.adaptiveConfig.moderateActivityThreshold) {
      activityLevel = 'moderate';
      reason = `Moderate activity: ${totalActivity} requests in monitoring window`;
      backgroundPaused = false;
    } else {
      activityLevel = 'low';
      reason = `Low activity: ${totalActivity} requests in monitoring window`;
      backgroundPaused = false;
    }

    // Reset counters for next period
    const key = buildAdaptiveMetaKey(
      metadata.PK.replace(`${EntityTypes.ADAPTIVE}#`, ''),
    );

    const updateCommand = new UpdateCommand({
      TableName: this.config.tableName,
      Key: key,
      UpdateExpression:
        'SET #data.#activityLevel = :activityLevel, #data.#reason = :reason, #data.#backgroundPaused = :backgroundPaused, #data.#lastCalculation = :now, #data.#userRequestCount = :zero, #data.#backgroundRequestCount = :zero',
      ExpressionAttributeNames: {
        '#data': TableAttributes.Data,
        '#activityLevel': 'activityLevel',
        '#reason': 'reason',
        '#backgroundPaused': 'backgroundPaused',
        '#lastCalculation': 'lastCalculation',
        '#userRequestCount': 'userRequestCount',
        '#backgroundRequestCount': 'backgroundRequestCount',
      },
      ExpressionAttributeValues: {
        ':activityLevel': activityLevel,
        ':reason': reason,
        ':backgroundPaused': backgroundPaused,
        ':now': now,
        ':zero': 0,
      },
    });

    await this.docClient.send(updateCommand);
  }

  private startCleanupInterval(): void {
    if (this.config.cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(async () => {
        try {
          await this.cleanup();
        } catch (error) {
          console.warn('DynamoDBAdaptiveRateLimitStore cleanup failed:', error);
        }
      }, this.config.cleanupIntervalMs);

      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }

  private startRecalculationInterval(): void {
    this.recalculationInterval = setInterval(async () => {
      try {
        await this.recalculateAllocations();
      } catch (error) {
        console.warn(
          'DynamoDBAdaptiveRateLimitStore recalculation failed:',
          error,
        );
      }
    }, this.adaptiveConfig.recalculationIntervalMs);

    if (typeof this.recalculationInterval.unref === 'function') {
      this.recalculationInterval.unref();
    }
  }
}
