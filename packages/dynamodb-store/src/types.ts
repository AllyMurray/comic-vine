import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { z } from 'zod';

/**
 * Configuration schema for DynamoDB store with validation and defaults
 */
export const DynamoDBStoreConfigSchema = z.object({
  /**
   * Name of the DynamoDB table to use for all store operations
   * Consumer is responsible for creating this table with the correct structure
   */
  tableName: z.string().default('comic-vine-store'),

  /**
   * AWS region for DynamoDB operations
   * If not provided, will use AWS SDK default region resolution
   */
  region: z.string().optional(),

  /**
   * Custom DynamoDB endpoint (useful for local DynamoDB)
   */
  endpoint: z.string().optional(),

  /**
   * Existing DynamoDB client instance to reuse
   * If not provided, a new client will be created
   */
  client: z.any().optional(),

  /**
   * Maximum number of retry attempts for failed operations
   */
  maxRetries: z.number().min(0).default(3),

  /**
   * Base delay in milliseconds between retry attempts
   */
  retryDelayMs: z.number().min(0).default(100),

  /**
   * Maximum number of items to include in batch operations
   * DynamoDB limit is 25, so this should not exceed that
   */
  batchSize: z.number().min(1).max(25).default(25),

  /**
   * Interval in milliseconds for cleanup operations
   * Set to 0 to disable automatic cleanup
   */
  cleanupIntervalMs: z.number().min(0).default(300000), // 5 minutes
});

/**
 * Configuration type for DynamoDB store
 */
export type DynamoDBStoreConfig = z.infer<typeof DynamoDBStoreConfigSchema>;

/**
 * Options for creating DynamoDB store instances
 */
export interface DynamoDBStoreOptions extends Partial<DynamoDBStoreConfig> {}

/**
 * Internal client wrapper for managing DynamoDB connections
 */
export interface DynamoDBClientWrapper {
  client: DynamoDBClient;
  isManaged: boolean; // Whether this store manages the client lifecycle
}

/**
 * Common error types for DynamoDB operations
 */
export class DynamoDBStoreError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly operation?: string,
  ) {
    super(message);
    this.name = 'DynamoDBStoreError';
  }
}

/**
 * Error thrown when the store has been destroyed/closed
 */
export class StoreDestroyedError extends DynamoDBStoreError {
  constructor(storeName: string) {
    super(`${storeName} has been destroyed and cannot be used`);
    this.name = 'StoreDestroyedError';
  }
}

/**
 * Error thrown when DynamoDB operations are throttled
 */
export class ThrottlingError extends DynamoDBStoreError {
  constructor(operation: string, cause?: Error) {
    super(`DynamoDB operation '${operation}' was throttled`, cause, operation);
    this.name = 'ThrottlingError';
  }
}

/**
 * Error thrown when DynamoDB item size exceeds limits
 */
export class ItemSizeError extends DynamoDBStoreError {
  constructor(size: number, limit: number) {
    super(`Item size (${size} bytes) exceeds DynamoDB limit (${limit} bytes)`);
    this.name = 'ItemSizeError';
  }
}
