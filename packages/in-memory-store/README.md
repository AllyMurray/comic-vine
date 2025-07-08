# @comic-vine/in-memory-store

In-memory store implementations for Comic Vine client caching, deduplication, and rate limiting.

## Installation

```bash
npm install @comic-vine/client @comic-vine/in-memory-store
```

## Usage

```typescript
import { RateLimitedComicVineClient } from '@comic-vine/client';
import {
  InMemoryCacheStore,
  InMemoryDedupeStore,
  InMemoryRateLimitStore,
} from '@comic-vine/in-memory-store';

const client = RateLimitedComicVineClient.create('your-api-key', {
  cache: new InMemoryCacheStore(),
  dedupe: new InMemoryDedupeStore(),
  rateLimit: new InMemoryRateLimitStore(),
});

// Use client normally - caching, deduplication, and rate limiting happen automatically
const issue = await client.issue.retrieve(1);
```

## Store Implementations

### InMemoryCacheStore

Provides in-memory caching with TTL support using JavaScript Maps.

```typescript
const cacheStore = new InMemoryCacheStore({
  cleanupIntervalMs: 60_000, // Cleanup expired items every minute
  maxItems: 1_000, // Hard cap on number of cached entries
  maxMemoryBytes: 50 * 1024 ** 2, // ~50 MB soft cap (LRU eviction when exceeded)
});
```

**Features:**

- TTL-based expiration
- Automatic cleanup of expired items
- **O(1) memory usage tracking** – the store maintains a running `totalSize` counter that is updated on insert/evict rather than scanning the whole cache on every write
- LRU eviction when either `maxItems` or `maxMemoryBytes` is exceeded (percentage controlled by `evictionRatio` – defaults to 10 %)
- Memory-usage statistics via `getStats()`
- Thread-safe operations

### InMemoryDedupeStore

Prevents duplicate concurrent requests using in-memory promise tracking.

```typescript
const dedupeStore = new InMemoryDedupeStore({
  jobTimeoutMs: 300000, // 5 minute timeout for jobs
});
```

**Features:**

- Automatic deduplication of identical requests
- Promise-based waiting for in-progress requests
- Job timeout handling
- Error propagation to all waiting requests

### InMemoryRateLimitStore

Implements sliding window rate limiting per resource.

```typescript
const rateLimitStore = new InMemoryRateLimitStore(
  { limit: 100, windowMs: 60000 }, // Default: 100 requests per minute
  new Map([
    ['issues', { limit: 50, windowMs: 60000 }], // Custom limits per resource
    ['characters', { limit: 200, windowMs: 60000 }],
  ]),
);
```

**Features:**

- Per-resource rate limiting
- Sliding window algorithm
- Configurable limits and time windows
- Real-time status reporting

## API Reference

### CacheStore Interface

```typescript
interface CacheStore {
  get(hash: string): Promise<any | undefined>;
  set(hash: string, value: any, ttlSeconds: number): Promise<void>;
  delete(hash: string): Promise<void>;
  clear(): Promise<void>;
}
```

### DedupeStore Interface

```typescript
interface DedupeStore {
  waitFor(hash: string): Promise<any | undefined>;
  register(hash: string): Promise<string>;
  complete(hash: string, value: any): Promise<void>;
  fail(hash: string, error: Error): Promise<void>;
  isInProgress(hash: string): Promise<boolean>;
}
```

### RateLimitStore Interface

```typescript
interface RateLimitStore {
  canProceed(resource: string): Promise<boolean>;
  record(resource: string): Promise<void>;
  getStatus(resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
  }>;
  reset(resource: string): Promise<void>;
  getWaitTime(resource: string): Promise<number>;
}
```

## Performance Characteristics

- **Memory Usage**: InMemoryCacheStore keeps an incremental `totalSize` counter, giving constant-time checks against `maxMemoryBytes`. No full-table scan happens on each write.
- **Concurrency**: All stores are designed to handle concurrent access safely.
- **Cleanup**: Automatic cleanup prevents memory leaks, but you can also manually trigger cleanup.

## Use Cases

Perfect for:

- Development and testing
- Single-instance applications
- Short-lived processes
- Applications where persistence is not required

Consider SQLite stores for:

- Production applications
- Multi-instance deployments
- Long-running processes
- When persistence across restarts is needed

## License

MIT
