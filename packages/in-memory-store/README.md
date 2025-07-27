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
  AdaptiveRateLimitStore, // NEW: Intelligent rate limiting
} from '@comic-vine/in-memory-store';

const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    cache: new InMemoryCacheStore(),
    dedupe: new InMemoryDedupeStore(),
    rateLimit: new AdaptiveRateLimitStore(), // Recommended for optimal API usage
  },
});

// Use client normally - data is cached in memory with intelligent rate limiting
const issue = await client.issue.retrieve(1, { priority: 'user' });
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

### AdaptiveRateLimitStore (Recommended)

Advanced rate limiting with intelligent priority-based capacity allocation that adapts to real-time user activity patterns.

```typescript
import type { AdaptiveRateLimitStoreOptions } from '@comic-vine/in-memory-store';

const adaptiveStore = new AdaptiveRateLimitStore({
  adaptiveConfig: {
    // Activity detection
    highActivityThreshold: 10, // Requests/15min to trigger priority mode
    moderateActivityThreshold: 3, // Requests/15min for moderate activity

    // Timing behavior
    monitoringWindowMs: 15 * 60 * 1000, // 15 minutes monitoring window
    sustainedInactivityThresholdMs: 30 * 60 * 1000, // 30min for full background scale-up
    recalculationIntervalMs: 30000, // Recalculate every 30 seconds

    // Capacity limits
    maxUserScaling: 2.0, // Maximum user capacity multiplier
    minUserReserved: 5, // Minimum guaranteed user requests
    backgroundPauseOnIncreasingTrend: true, // Pause background on user surge
  },
});
```

**Features:**

- **Real-time adaptation**: Dynamically allocates capacity based on user activity patterns
- **Priority-aware**: Distinguishes between user requests and background operations
- **Four adaptive strategies**: Night mode, low activity, moderate activity, high activity
- **Zero configuration**: Works perfectly with intelligent defaults
- **Memory efficient**: In-memory activity tracking with automatic cleanup
- **Trend detection**: Recognizes increasing, stable, decreasing, or no activity trends

**How It Works:**

```typescript
// Night time (zero user activity for 30+ minutes)
// → Background gets 100% capacity (200/200 requests)

// Low activity (1-2 user requests per 15 minutes)
// → Users: 30% reserved, Background: 70% capacity

// Moderate activity (3-9 user requests per 15 minutes)
// → Dynamic scaling based on trends and activity level

// High activity (10+ user requests per 15 minutes)
// → Users: 90% priority capacity, Background: paused during increasing trends
```

**Usage with Priority:**

```typescript
import ComicVine from '@comic-vine/client';
import { AdaptiveRateLimitStore } from '@comic-vine/in-memory-store';

const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new AdaptiveRateLimitStore(), // Zero config needed!
  },
});

// User-facing requests get priority during high activity
const character = await client.character.retrieve(1443, {
  priority: 'user',
});

// Background operations get remaining capacity
const volumes = await client.volume.list({
  priority: 'background',
});

// Check adaptive status
const status = await client.stores.rateLimit.getStatus('characters');
console.log(status.adaptive);
// {
//   userReserved: 120,
//   backgroundMax: 80,
//   backgroundPaused: false,
//   recentUserActivity: 4,
//   reason: "Moderate user activity - dynamic scaling (1.2x user capacity)"
// }
```

## How Stores Work Together

The three store types work in sequence to optimize API requests:

### Request Processing Order

1. **Cache Store**: Checks for existing response (immediate return if found)
2. **Dedupe Store**: Prevents duplicate concurrent requests (waits for in-progress requests)
3. **Rate Limit Store**: Enforces API limits (waits or throws if limit exceeded)

```typescript
// Example: Multiple concurrent requests for the same resource
const [a, b, c] = await Promise.all([
  client.issue.retrieve(1), // Cache miss → dedupe register → rate limit check → API call
  client.issue.retrieve(1), // Cache miss → dedupe wait (shares result from first call)
  client.issue.retrieve(1), // Cache miss → dedupe wait (shares result from first call)
]);

// Subsequent calls return from cache
const d = await client.issue.retrieve(1); // Cache hit → immediate return
```

### Store Lifecycle

Each store manages its own lifecycle and cleanup:

- **Cache**: Expires entries based on TTL, evicts LRU items when full
- **Dedupe**: Times out jobs, cleans up completed requests
- **Rate Limit**: Slides time windows, removes expired request records

### Memory Management

All stores are designed for efficient memory usage:

- **Cache**: LRU eviction with configurable memory limits
- **Dedupe**: Automatic cleanup of completed/failed jobs
- **Rate Limit**: Sliding window removes old timestamps automatically

## Configuration Examples

### Basic Setup

```typescript
import ComicVine from '@comic-vine/client';
import {
  InMemoryCacheStore,
  InMemoryDedupeStore,
  AdaptiveRateLimitStore, // Recommended for intelligent rate limiting
} from '@comic-vine/in-memory-store';

const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    cache: new InMemoryCacheStore(),
    dedupe: new InMemoryDedupeStore(),
    rateLimit: new AdaptiveRateLimitStore(), // Zero configuration needed!
  },
});
```

### Custom Configuration

**With Traditional Rate Limiting:**

```typescript
const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
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
  },
});
```

**With Adaptive Rate Limiting (Recommended):**

```typescript
const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    cache: new InMemoryCacheStore({
      maxSize: 5000,
      ttl: 600_000, // 10 minutes
      cleanupIntervalMs: 120_000, // 2 minutes
    }),
    dedupe: new InMemoryDedupeStore({
      jobTimeoutMs: 600_000, // 10 minutes
      cleanupIntervalMs: 120_000, // 2 minutes
    }),
    rateLimit: new AdaptiveRateLimitStore({
      adaptiveConfig: {
        // Fine-tune behavior for your use case
        highActivityThreshold: 15, // Requests/15min to trigger priority mode
        sustainedInactivityThresholdMs: 45 * 60 * 1000, // 45min before full background mode
        maxUserScaling: 1.5, // Conservative user scaling
        minUserReserved: 10, // Higher minimum for users
      },
    }),
  },
});
```

## TypeScript Support

All stores export their option interfaces for type safety:

```typescript
import type {
  InMemoryCacheStoreOptions,
  InMemoryDedupeStoreOptions,
  InMemoryRateLimitStoreOptions,
  AdaptiveRateLimitStoreOptions, // NEW: Adaptive rate limiting options
} from '@comic-vine/in-memory-store';

// Type-safe configuration for traditional rate limiting
const rateLimitOptions: InMemoryRateLimitStoreOptions = {
  defaultConfig: { limit: 200, windowMs: 3600000 },
  resourceConfigs: new Map([['issues', { limit: 100, windowMs: 3600000 }]]),
};

// Type-safe configuration for adaptive rate limiting
const adaptiveOptions: AdaptiveRateLimitStoreOptions = {
  adaptiveConfig: {
    highActivityThreshold: 15,
    sustainedInactivityThresholdMs: 45 * 60 * 1000,
    maxUserScaling: 1.5,
  },
};

const adaptiveStore = new AdaptiveRateLimitStore(adaptiveOptions);
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

## Store Comparison

### Rate Limiting: Adaptive vs Traditional

| Feature                    | Traditional Rate Limiting | Adaptive Rate Limiting      |
| -------------------------- | ------------------------- | --------------------------- |
| **Configuration Required** | Yes (limits per resource) | No (intelligent defaults)   |
| **API Utilization**        | Fixed allocation          | Dynamic (up to 100%)        |
| **User Experience**        | First-come-first-served   | Priority during activity    |
| **Background Processing**  | Competes with users       | Scales up when idle         |
| **Activity Awareness**     | No                        | Real-time monitoring        |
| **Trend Detection**        | No                        | Yes (increasing/decreasing) |
| **Night/Off-hours**        | Wasted capacity           | Full background utilization |

**When to use Traditional Rate Limiting:**

- Simple, predictable workloads
- No distinction between user/background requests
- Fixed capacity requirements

**When to use Adaptive Rate Limiting (Recommended):**

- Applications with varying user activity
- Mix of interactive and background operations
- Want to maximize API utilization
- Need responsive user experience

### In-Memory vs SQLite Stores

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

## License

MIT
