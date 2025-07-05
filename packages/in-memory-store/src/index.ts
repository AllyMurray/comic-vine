export { InMemoryCacheStore } from './in-memory-cache-store.js';
export { InMemoryDedupeStore } from './in-memory-dedupe-store.js';
export { InMemoryRateLimitStore } from './in-memory-rate-limit-store.js';
export type { RateLimitConfig } from './in-memory-rate-limit-store.js';

// Re-export the store interfaces from the client package for convenience
export type {
  CacheStore,
  DedupeStore,
  RateLimitStore,
} from '@comic-vine/client';
