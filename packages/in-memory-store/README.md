# @comic-vine/in-memory-store

In-memory store implementations for Comic Vine client caching, deduplication, and rate limiting.

## Installation

```bash
npm install @comic-vine/in-memory-store @comic-vine/client
```

## Usage

```typescript
import ComicVine from '@comic-vine/client';
import {
  InMemoryCacheStore,
  InMemoryDedupeStore,
  InMemoryRateLimitStore,
} from '@comic-vine/in-memory-store';

const client = new ComicVine('your-api-key', undefined, {
  cache: new InMemoryCacheStore(),
  dedupe: new InMemoryDedupeStore(),
  rateLimit: new InMemoryRateLimitStore(),
});

// Use client normally - data is cached in memory
const issue = await client.issue.retrieve(1);
```

## Key Features

- **High Performance**: All operations are in-memory for maximum speed
- **Object-based Configuration**: Clean, type-safe constructor parameters
- **Zero Dependencies**: No external storage requirements
- **Type Safety**: Full TypeScript support with exported option interfaces

## Store Implementations

### InMemoryCacheStore

Provides in-memory caching with TTL support.

```typescript
const cacheStore = new InMemoryCacheStore({
  maxSize: 1000, // Maximum number of entries
  ttl: 300000, // 5 minutes TTL
  cleanupIntervalMs: 60000, // Cleanup expired items every minute
});
```

**Features:**

- LRU eviction when max size is reached
- TTL-based expiration with automatic cleanup
- Fast O(1) get/set operations
- Memory-efficient storage

### InMemoryDedupeStore

Prevents duplicate concurrent requests using in-memory coordination.

```typescript
import type { InMemoryDedupeStoreOptions } from '@comic-vine/in-memory-store';

const dedupeStore = new InMemoryDedupeStore({
  jobTimeoutMs: 300_000, // 5 minute timeout for jobs (default)
  cleanupIntervalMs: 60_000, // Cleanup interval (default: 1 minute)
});
```

**Features:**

- Promise-based deduplication
- Automatic cleanup of expired jobs
- Error state handling and propagation
- Memory-efficient job tracking
- Configurable job timeouts and cleanup intervals

### InMemoryRateLimitStore

Implements sliding window rate limiting with in-memory tracking.

```typescript
import type { InMemoryRateLimitStoreOptions } from '@comic-vine/in-memory-store';

const rateLimitStore = new InMemoryRateLimitStore({
  defaultConfig: { limit: 100, windowMs: 60_000 }, // Default: 100 req/min
  resourceConfigs: new Map([
    ['issues', { limit: 50, windowMs: 60_000 }], // Custom per-resource limits
    ['characters', { limit: 200, windowMs: 60_000 }],
  ]),
});
```

**Features:**

- Sliding window algorithm
- Per-resource configuration
- Automatic cleanup of expired records
- Memory-efficient timestamp tracking
- Flexible default and per-resource configurations

## Configuration Examples

### Basic Setup

```typescript
import ComicVine from '@comic-vine/client';
import {
  InMemoryCacheStore,
  InMemoryDedupeStore,
  InMemoryRateLimitStore,
} from '@comic-vine/in-memory-store';

const client = new ComicVine('your-api-key', undefined, {
  cache: new InMemoryCacheStore(),
  dedupe: new InMemoryDedupeStore(),
  rateLimit: new InMemoryRateLimitStore(),
});
```

### Custom Configuration

```typescript
const client = new ComicVine('your-api-key', undefined, {
  cache: new InMemoryCacheStore({
    maxSize: 5000,
    ttl: 600_000, // 10 minutes
    cleanupIntervalMs: 120_000, // 2 minutes
  }),
  dedupe: new InMemoryDedupeStore({
    jobTimeoutMs: 600_000, // 10 minutes
    cleanupIntervalMs: 120_000, // 2 minutes
  }),
  rateLimit: new InMemoryRateLimitStore({
    defaultConfig: { limit: 200, windowMs: 60_000 }, // 200 requests per minute
    resourceConfigs: new Map([
      ['issues', { limit: 100, windowMs: 60_000 }],
      ['characters', { limit: 300, windowMs: 60_000 }],
    ]),
  }),
});
```

## TypeScript Support

All stores export their option interfaces for type safety:

```typescript
import type {
  InMemoryCacheStoreOptions,
  InMemoryDedupeStoreOptions,
  InMemoryRateLimitStoreOptions,
} from '@comic-vine/in-memory-store';

// Type-safe configuration
const cacheOptions: InMemoryCacheStoreOptions = {
  maxSize: 2000,
  ttl: 300_000,
  cleanupIntervalMs: 60_000,
};

const cache = new InMemoryCacheStore(cacheOptions);
```

## Performance Characteristics

### Memory Usage

- **Cache**: O(n) where n is the number of cached entries
- **Dedupe**: O(m) where m is the number of active jobs
- **Rate Limit**: O(r × t) where r is resources and t is tracking window

### Time Complexity

- **Cache Get/Set**: O(1) average case
- **Dedupe Check**: O(1) lookup
- **Rate Limit Check**: O(log n) where n is requests in window

## Comparison with SQLite Stores

| Feature           | In-Memory   | SQLite               |
| ----------------- | ----------- | -------------------- |
| **Performance**   | Fastest     | Fast                 |
| **Persistence**   | No          | Yes                  |
| **Memory Usage**  | Higher      | Lower                |
| **Cross-Process** | No          | Yes                  |
| **Setup**         | Zero config | Requires file system |

Choose in-memory stores for:

- Single-process applications
- Maximum performance requirements
- Development and testing
- Stateless deployments

Choose SQLite stores for:

- Multi-process applications
- Persistent caching across restarts
- Production deployments
- Resource-constrained environments

## API Reference

All stores implement the same interfaces as the SQLite versions:

- `CacheStore`
- `DedupeStore`
- `RateLimitStore`

## Migration from Previous Versions

If upgrading from a version with positional constructor arguments:

```typescript
// Old positional syntax (no longer supported)
// new InMemoryDedupeStore(300_000)
// new InMemoryRateLimitStore(defaultConfig, resourceConfigs)

// New object syntax
new InMemoryDedupeStore({
  jobTimeoutMs: 300_000,
})

new InMemoryRateLimitStore({
  defaultConfig: { limit: 100, windowMs: 60_000 },
  resourceConfigs: new Map([...]),
})
```

## License

MIT
