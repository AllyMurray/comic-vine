export { SQLiteCacheStore } from './sqlite-cache-store.js';
export { SQLiteDedupeStore } from './sqlite-dedupe-store.js';
export { SQLiteRateLimitStore } from './sqlite-rate-limit-store.js';
export { SqliteAdaptiveRateLimitStore } from './sqlite-adaptive-rate-limit-store.js';
export type { SQLiteCacheStoreOptions } from './sqlite-cache-store.js';
export type { SQLiteDedupeStoreOptions } from './sqlite-dedupe-store.js';
export type { SQLiteRateLimitStoreOptions } from './sqlite-rate-limit-store.js';
export type { SqliteAdaptiveRateLimitStoreOptions } from './sqlite-adaptive-rate-limit-store.js';
export type { RateLimitConfig } from '@comic-vine/client';
export * from './schema.js';

// Re-export the store interfaces from the client package for convenience
export type {
  CacheStore,
  DedupeStore,
  RateLimitStore,
  AdaptiveRateLimitStore,
  RequestPriority,
  AdaptiveConfig,
} from '@comic-vine/client';
