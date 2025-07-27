/**
 * @comic-vine/dynamodb-store
 *
 * DynamoDB-backed implementations of Comic Vine client store interfaces
 * for caching, deduplication, and rate limiting.
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
} from './types.js';

// Client utilities
export { createDynamoDBClient, destroyDynamoDBClient } from './client.js';

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
