export { SQLiteCacheStore } from './sqlite-cache-store.js';
export { SQLiteDedupeStore } from './sqlite-dedupe-store.js';
export { SQLiteRateLimitStore } from './sqlite-rate-limit-store.js';
export type { RateLimitConfig } from '@comic-vine/client';
export * from './schema.js';

// Re-export the store interfaces from the client package for convenience
export type {
  CacheStore,
  DedupeStore,
  RateLimitStore,
} from '@comic-vine/client';
