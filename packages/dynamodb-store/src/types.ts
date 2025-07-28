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

  /**
   * Circuit breaker configuration
   */
  circuitBreaker: z
    .object({
      /**
       * Number of consecutive failures before opening the circuit
       */
      failureThreshold: z.number().min(1).default(5),

      /**
       * Time in milliseconds to wait before attempting to close the circuit
       */
      recoveryTimeoutMs: z.number().min(1000).default(60000), // 1 minute

      /**
       * Timeout in milliseconds for individual operations
       */
      timeoutMs: z.number().min(100).default(30000), // 30 seconds

      /**
       * Whether to enable the circuit breaker
       */
      enabled: z.boolean().default(true),
    })
    .default({}),

  /**
   * Monitoring and observability configuration
   */
  monitoring: z
    .object({
      /**
       * CloudWatch metrics configuration
       */
      cloudWatch: z
        .object({
          enabled: z.boolean().default(false),
          namespace: z.string().default('DynamoDBStore'),
          region: z.string().optional(),
        })
        .optional(),

      /**
       * Logging configuration
       */
      logging: z
        .object({
          enabled: z.boolean().default(true),
          level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        })
        .optional(),

      /**
       * Performance monitoring configuration
       */
      performance: z
        .object({
          enabled: z.boolean().default(true),
          samplingRate: z.number().min(0).max(1).default(1.0),
        })
        .optional(),

      /**
       * Health check configuration
       */
      healthChecks: z
        .object({
          enabled: z.boolean().default(false),
          intervalMs: z.number().min(1000).default(60000), // 1 minute
        })
        .optional(),

      /**
       * Default dimensions to add to all metrics
       */
      defaultDimensions: z.record(z.string()).optional(),
    })
    .optional(),
});

/**
 * Monitoring configuration type extracted from schema
 */
export type MonitoringConfig = NonNullable<
  z.infer<typeof DynamoDBStoreConfigSchema>['monitoring']
>;

/**
 * Configuration type for DynamoDB store
 */
export type DynamoDBStoreConfig = z.infer<typeof DynamoDBStoreConfigSchema>;

/**
 * Options for creating DynamoDB store instances
 */
export type DynamoDBStoreOptions = Partial<DynamoDBStoreConfig>;

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
    public override readonly cause?: Error,
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

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends DynamoDBStoreError {
  constructor(operation: string, nextAttemptTime: Date) {
    super(
      `Circuit breaker is open for operation '${operation}'. Next attempt allowed at ${nextAttemptTime.toISOString()}`,
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Error thrown when operation times out
 */
export class OperationTimeoutError extends DynamoDBStoreError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`);
    this.name = 'OperationTimeoutError';
  }
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker internal state
 */
export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}
