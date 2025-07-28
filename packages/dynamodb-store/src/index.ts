/**
 * @comic-vine/dynamodb-store
 *
 * DynamoDB-backed implementations of Comic Vine client store interfaces
 * for caching, deduplication, and rate limiting.
 *
 * Features:
 * - TTL-based caching with automatic cleanup
 * - Request deduplication with job tracking
 * - Resource-based rate limiting with adaptive algorithms
 * - Circuit breaker pattern for resilience
 * - Performance optimization with parallel processing
 * - CloudWatch metrics integration
 * - Structured logging with correlation IDs
 * - Health checks and monitoring
 */

// Core store implementations
export { DynamoDBCacheStore } from './dynamodb-cache-store.js';
export { DynamoDBDedupeStore } from './dynamodb-dedupe-store.js';
export { DynamoDBRateLimitStore } from './dynamodb-rate-limit-store.js';
export { DynamoDBAdaptiveRateLimitStore } from './dynamodb-adaptive-rate-limit-store.js';

// Types and configuration
export type {
  DynamoDBStoreConfig,
  DynamoDBStoreOptions,
  DynamoDBClientWrapper,
} from './types.js';

export {
  DynamoDBStoreConfigSchema,
  DynamoDBStoreError,
  StoreDestroyedError,
  ThrottlingError,
  ItemSizeError,
  CircuitBreakerOpenError,
  OperationTimeoutError,
  CircuitBreakerState,
} from './types.js';

export type { CircuitBreakerStatus } from './types.js';

// Client utilities
export {
  createDynamoDBClient,
  destroyDynamoDBClient,
  createCircuitBreaker,
} from './client.js';

// Circuit breaker
export { CircuitBreaker } from './circuit-breaker.js';

// Utility functions
export {
  calculateTTL,
  isExpired,
  serializeValue,
  deserializeValue,
  sleep,
  calculateBackoffDelay,
  isThrottlingError,
  isConditionalCheckFailedError,
  retryWithBackoff,
  chunkArray,
  isSevereError,
  calculateOptimalBatchSize,
  measureExecutionTime,
  MAX_ITEM_SIZE_BYTES,
  DEFAULT_DEDUPE_TTL_SECONDS,
} from './utils.js';

// Performance optimization utilities
export {
  executeInParallel,
  executeInBatches,
  PromisePool,
  BatchWriter,
  AdaptiveDelayCalculator,
} from './performance.js';

export type { ParallelProcessingConfig } from './performance.js';

// Schema and key utilities
export {
  TableAttributes,
  Indexes,
  EntityTypes,
  SortKeys,
  buildCacheKey,
  buildDedupeKey,
  buildRateLimitKey,
  buildAdaptiveMetaKey,
  buildExpirationGSI1Key,
  extractHashFromCacheKey,
  extractResourceFromRateLimitKey,
  extractJobIdFromDedupeKey,
  extractTimestampAndUuidFromRateLimitKey,
} from './schema.js';

export type {
  CacheItem,
  DedupeItem,
  RateLimitItem,
  AdaptiveMetaItem,
} from './schema.js';

// Phase 5: Production Readiness Features

// Monitoring and observability
export {
  Monitor,
  ConsoleLogger,
  getGlobalMonitor,
  setGlobalMonitor,
  monitorOperation,
} from './monitoring.js';

export type {
  CorrelationContext,
  MetricData,
  PerformanceMetrics,
  HealthCheckResult,
  Logger,
  MonitoringConfig,
} from './monitoring.js';

// CloudWatch integration
export {
  CloudWatchMetricsPublisher,
  CloudWatchMetrics,
  CloudWatchDashboardConfig,
  createCloudWatchClient,
} from './cloudwatch.js';

export type { CloudWatchClient } from './cloudwatch.js';

// Updated monitoring configuration type
export type { MonitoringConfig as StoreMonitoringConfig } from './types.js';
