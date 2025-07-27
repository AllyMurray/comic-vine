# @comic-vine/sqlite-store

SQLite store implementations for Comic Vine client caching, deduplication, and rate limiting using Drizzle ORM.

## Installation

```bash
npm install @comic-vine/sqlite-store @comic-vine/client
```

## Usage

```typescript
import Database from 'better-sqlite3';
import ComicVine from '@comic-vine/client';
import {
  SQLiteCacheStore,
  SQLiteDedupeStore,
  SQLiteRateLimitStore,
  SqliteAdaptiveRateLimitStore, // NEW: Intelligent persistent rate limiting
} from '@comic-vine/sqlite-store';

// Create ONE shared connection which every store will use.
const sharedDb = new Database('./comic-vine.db');

const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    cache: new SQLiteCacheStore({ database: sharedDb }),
    dedupe: new SQLiteDedupeStore({ database: sharedDb }),
    rateLimit: new SqliteAdaptiveRateLimitStore({ database: sharedDb }), // Recommended
  },
});

// Use client normally - data persists with intelligent rate limiting
const issue = await client.issue.retrieve(1, { priority: 'user' });
```

## Key Features

- **Shared Database Support**: All stores can use the same SQLite database file/connection
- **Object-based Configuration**: Clean, type-safe constructor parameters
- **Connection Management**: Automatic handling of database connection lifecycle
- **Type Safety**: Full TypeScript support with exported option interfaces

## Store Implementations

### SQLiteCacheStore

Provides persistent caching with TTL support using SQLite database.

```typescript
import type { SQLiteCacheStoreOptions } from '@comic-vine/sqlite-store';

const cacheStore = new SQLiteCacheStore({
  database: './cache.db', // File path, ':memory:', or Database instance
  cleanupIntervalMs: 60_000, // Cleanup expired items every minute (default)
  maxEntrySizeBytes: 5 * 1024 * 1024, // 5MB max per entry (default)
});
```

**Features:**

- Persistent storage across application restarts
- TTL-based expiration with automatic cleanup
- Database-level ACID transactions
- Efficient indexing for fast lookups
- Automatic schema creation and migration
- Size limits to prevent SQLite length violations
- Shared database connection support

### SQLiteDedupeStore

Prevents duplicate concurrent requests using SQLite for coordination.

```typescript
import type { SQLiteDedupeStoreOptions } from '@comic-vine/sqlite-store';

const dedupeStore = new SQLiteDedupeStore({
  database: './dedupe.db', // File path, ':memory:', or Database instance
  jobTimeoutMs: 300_000, // 5 minute timeout for jobs (default)
  cleanupIntervalMs: 60_000, // Cleanup interval (default: 1 minute)
});
```

**Features:**

- Cross-process deduplication support
- Persistent job state tracking
- Automatic cleanup of expired jobs
- Promise-based waiting with database coordination
- Error state persistence and recovery
- Configurable job timeouts and cleanup intervals

### SQLiteRateLimitStore

Implements sliding window rate limiting with SQLite persistence.

```typescript
import type { SQLiteRateLimitStoreOptions } from '@comic-vine/sqlite-store';

const rateLimitStore = new SQLiteRateLimitStore({
  database: './rate-limits.db', // File path, ':memory:', or Database instance
  defaultConfig: { limit: 100, windowMs: 60_000 }, // Default: 100 req/min
  resourceConfigs: new Map([
    ['issues', { limit: 50, windowMs: 60_000 }], // Custom per-resource limits
    ['characters', { limit: 200, windowMs: 60_000 }],
  ]),
});
```

**Features:**

- Persistent rate limit tracking
- Per-resource configuration
- Sliding window algorithm
- Cross-process rate limit enforcement
- Automatic cleanup of expired records
- Flexible default and per-resource configurations

### SqliteAdaptiveRateLimitStore (Recommended)

Advanced rate limiting with intelligent priority-based capacity allocation that persists across application restarts and supports cross-process coordination.

```typescript
import type { SqliteAdaptiveRateLimitStoreOptions } from '@comic-vine/sqlite-store';

const adaptiveStore = new SqliteAdaptiveRateLimitStore({
  database: './comic-vine.db', // Shared database for all stores
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

**Unique SQLite Features:**

- **Cross-Process Coordination**: Multiple application instances share the same rate limiting state
- **Persistent Activity Tracking**: Rate limiting history survives application restarts
- **Recovery Support**: Handles application crashes gracefully with timeout recovery
- **Performance Optimized**: Hybrid approach with in-memory metrics and SQLite persistence
- **Migration Support**: Automatically upgrades database schema with priority column

**How SQLite Adaptive Rate Limiting Works:**

```typescript
// Process A (web server)
const webClient = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new SqliteAdaptiveRateLimitStore({ database: sharedDb }),
  },
});

// Process B (background worker) - shares the same rate limiting state
const workerClient = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new SqliteAdaptiveRateLimitStore({ database: sharedDb }),
  },
});

// Web server requests get priority during high activity
const userCharacter = await webClient.character.retrieve(1443, {
  priority: 'user',
});

// Background worker respects the adaptive allocation
const backgroundVolumes = await workerClient.volume.list({
  priority: 'background', // May be throttled if web server is active
});
```

**Persistence Benefits:**

```typescript
// Application restart scenario
const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new SqliteAdaptiveRateLimitStore({
      database: './comic-vine.db',
    }),
  },
});

// Rate limiting history is preserved:
// - Recent activity patterns remain tracked
// - Capacity allocation continues from where it left off
// - No "cold start" penalty on rate limiting behavior
```

## How Stores Work Together

The SQLite stores provide persistent versions of the same request optimization flow:

### Request Processing Order

1. **Cache Store**: Checks SQLite cache table for existing response
2. **Dedupe Store**: Uses SQLite to coordinate concurrent requests across processes
3. **Rate Limit Store**: Enforces API limits using persistent SQLite tracking

```typescript
// Example: Cross-process request coordination
// Process A makes request
const issueA = await clientA.issue.retrieve(1); // Cache miss → dedupe register → rate limit → API call

// Process B (same or different process) makes same request concurrently
const issueB = await clientB.issue.retrieve(1); // Cache miss → dedupe wait → shares result from Process A
```

### Persistence Benefits

Unlike in-memory stores, SQLite stores survive application restarts:

- **Cache**: Cached responses remain available after restart
- **Dedupe**: In-progress requests survive process crashes (with timeout recovery)
- **Rate Limit**: Rate limit history persists, preventing limit bypassing via restart

### Cross-Process Coordination

SQLite stores enable multiple processes to share the same optimization state:

```typescript
// Multiple processes can safely share rate limits and cache
const sharedDb = new Database('./shared-stores.db');

// Process 1
const client1 = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new SQLiteRateLimitStore({ database: sharedDb }),
  },
});

// Process 2 - shares the same rate limits
const client2 = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new SQLiteRateLimitStore({ database: sharedDb }),
  },
});
```

## Shared Database Configuration

**Recommended**: Use a single database for all stores to reduce file handles and improve performance:

```typescript
import Database from 'better-sqlite3';

// Single database approach (recommended)
const db = new Database('./comic-vine-stores.db');

const stores = {
  cache: new SQLiteCacheStore({ database: db }),
  dedupe: new SQLiteDedupeStore({ database: db }),
  rateLimit: new SqliteAdaptiveRateLimitStore({ database: db }), // Adaptive rate limiting
};

// The stores automatically create their own tables within the shared database
```

**Cross-Process Setup (Multiple Application Instances):**

```typescript
// All processes share the same database file for coordination
const sharedDbPath = './shared-comic-vine.db';

// Process 1: Web Server
const webClient = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    cache: new SQLiteCacheStore({ database: sharedDbPath }),
    rateLimit: new SqliteAdaptiveRateLimitStore({ database: sharedDbPath }),
  },
});

// Process 2: Background Worker
const workerClient = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new SqliteAdaptiveRateLimitStore({ database: sharedDbPath }),
  },
});

// Both processes coordinate through the shared SQLite database
```

**Alternative**: Separate databases per store:

```typescript
// Separate database files (alternative approach)
const stores = {
  cache: new SQLiteCacheStore({ database: './cache.db' }),
  dedupe: new SQLiteDedupeStore({ database: './dedupe.db' }),
  rateLimit: new SQLiteRateLimitStore({ database: './rate-limits.db' }),
};
```

## Database Schema

The SQLite stores use the following schema:

### Cache Table

```sql
CREATE TABLE cache (
  hash TEXT PRIMARY KEY,
  value BLOB NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

### Dedupe Jobs Table

```sql
CREATE TABLE dedupe_jobs (
  hash TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'completed', 'failed'
  result BLOB,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Rate Limits Table

**Enhanced Schema (Adaptive Rate Limiting):**

```sql
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  priority TEXT NOT NULL DEFAULT 'background' -- NEW: Priority tracking
);

-- Optimized indexes for adaptive rate limiting
CREATE INDEX IF NOT EXISTS idx_rate_limit_resource ON rate_limits(resource);
CREATE INDEX IF NOT EXISTS idx_rate_limit_timestamp ON rate_limits(timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limit_resource_priority_timestamp
  ON rate_limits(resource, priority, timestamp);
```

**Legacy Schema (Traditional Rate Limiting):**

```sql
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
```

The adaptive rate limiting store automatically migrates existing databases by adding the `priority` column with a default value of `'background'`, ensuring backward compatibility with existing rate limiting data.

## Configuration

### Database Paths

- Use file paths for persistent storage: `'./my-cache.db'`
- Use `':memory:'` for in-memory databases (faster, but not persistent)
- Relative paths are resolved from the current working directory
- Pass existing `Database` instances for connection sharing

### Performance Tuning

```typescript
// For high-throughput applications
const sharedDb = new Database('./data/comic-vine.db');

const stores = {
  cache: new SQLiteCacheStore({
    database: sharedDb,
    cleanupIntervalMs: 300_000, // Less frequent cleanup
    maxEntrySizeBytes: 10 * 1024 * 1024, // 10MB max entries
  }),
  dedupe: new SQLiteDedupeStore({
    database: sharedDb,
    jobTimeoutMs: 600_000, // Longer timeout for slow operations
    cleanupIntervalMs: 300_000, // Less frequent cleanup
  }),
  rateLimit: new SQLiteRateLimitStore({
    database: sharedDb,
    defaultConfig: { limit: 1000, windowMs: 60_000 }, // Higher limits
  }),
};
```

## TypeScript Support

All stores export their option interfaces for type safety:

```typescript
import type {
  SQLiteCacheStoreOptions,
  SQLiteDedupeStoreOptions,
  SQLiteRateLimitStoreOptions,
  SqliteAdaptiveRateLimitStoreOptions, // NEW: Adaptive rate limiting options
} from '@comic-vine/sqlite-store';

// Type-safe configuration for traditional rate limiting
const rateLimitOptions: SQLiteRateLimitStoreOptions = {
  database: './rate-limits.db',
  defaultConfig: { limit: 200, windowMs: 3600000 },
  resourceConfigs: new Map([['issues', { limit: 100, windowMs: 3600000 }]]),
};

// Type-safe configuration for adaptive rate limiting
const adaptiveOptions: SqliteAdaptiveRateLimitStoreOptions = {
  database: './comic-vine.db',
  adaptiveConfig: {
    highActivityThreshold: 15,
    sustainedInactivityThresholdMs: 45 * 60 * 1000,
    maxUserScaling: 1.5,
  },
};

const adaptiveStore = new SqliteAdaptiveRateLimitStore(adaptiveOptions);
```

## Deployment Considerations

### Docker

```dockerfile
# Ensure SQLite files are persisted
VOLUME ["/app/data"]

# Your application
COPY . /app
WORKDIR /app

# Use shared database path
ENV COMIC_VINE_DB_PATH=/app/data/comic-vine.db
```

### File Permissions

Ensure the application has read/write permissions to the database directory:

```bash
# Create data directory with correct permissions
mkdir -p ./data
chmod 755 ./data
```

### Backup and Maintenance

```bash
# Backup shared database
cp comic-vine.db comic-vine.db.backup

# Vacuum database to optimize performance
sqlite3 comic-vine.db "VACUUM;"

# Check database integrity
sqlite3 comic-vine.db "PRAGMA integrity_check;"
```

### Production Considerations for Adaptive Rate Limiting

**Multi-Instance Deployments:**

```typescript
// Docker Compose setup with shared volume
// docker-compose.yml
services:
  web:
    build: .
    volumes:
      - ./data:/app/data
    environment:
      - COMIC_VINE_DB_PATH=/app/data/shared.db

  worker:
    build: .
    volumes:
      - ./data:/app/data  # Same shared volume
    environment:
      - COMIC_VINE_DB_PATH=/app/data/shared.db

// Application code
const client = new ComicVine({
  apiKey: process.env.COMIC_VINE_API_KEY,
  stores: {
    rateLimit: new SqliteAdaptiveRateLimitStore({
      database: process.env.COMIC_VINE_DB_PATH,
    }),
  },
});
```

**Load Balancer Scenarios:**

```typescript
// Each application instance behind a load balancer
// shares the same rate limiting state through SQLite

// Instance 1 (handles user requests)
const webInstance1 = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new SqliteAdaptiveRateLimitStore({
      database: '/shared/comic-vine.db',
    }),
  },
});

// Instance 2 (handles background jobs)
const backgroundInstance = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new SqliteAdaptiveRateLimitStore({
      database: '/shared/comic-vine.db', // Same database
    }),
  },
});

// Adaptive system coordinates across all instances
```

## API Reference

All stores implement the same interfaces as the in-memory versions:

- `CacheStore`
- `DedupeStore`
- `RateLimitStore`

Additional methods specific to SQLite stores:

### SQLiteCacheStore

```typescript
// Get database statistics
const stats = await cacheStore.getStats();
// { totalItems: 1250, expiredItems: 23, databaseSizeKB: 512 }

// Manual cleanup
await cacheStore.cleanup();

// Close database connection
await cacheStore.close();
```

### SQLiteDedupeStore

```typescript
// Get job statistics
const stats = await dedupeStore.getStats();
// { totalJobs: 15, pendingJobs: 3, completedJobs: 10, failedJobs: 2, expiredJobs: 0 }

// Manual cleanup
await dedupeStore.cleanup();

// Close database connection
await dedupeStore.close();
```

### SQLiteRateLimitStore

```typescript
// Get rate limiting statistics
const stats = await rateLimitStore.getStats();
// { totalRequests: 1543, uniqueResources: 8, rateLimitedResources: ['issues'] }

// Configure resource-specific limits
rateLimitStore.setResourceConfig('volumes', { limit: 25, windowMs: 60000 });

// Manual cleanup
await rateLimitStore.cleanup();

// Close database connection
await rateLimitStore.close();
```

### SqliteAdaptiveRateLimitStore

```typescript
// Get comprehensive statistics including adaptive metrics
const stats = await adaptiveStore.getStats();
// {
//   totalRequests: 2157,
//   uniqueResources: 12,
//   rateLimitedResources: ['issues'],
//   adaptiveMetrics: {
//     averageUserActivity: 8.5,
//     backgroundUtilization: 0.75,
//     priorityModeActivations: 14
//   }
// }

// Check current adaptive status
const status = await adaptiveStore.getStatus('characters');
console.log(status.adaptive);
// {
//   userReserved: 140,
//   backgroundMax: 60,
//   backgroundPaused: false,
//   recentUserActivity: 7,
//   reason: "Moderate user activity - dynamic scaling (1.4x user capacity)"
// }

// Configure resource-specific traditional limits (if needed)
adaptiveStore.setResourceConfig('videos', { limit: 50, windowMs: 3600000 });

// Manual cleanup (cleans both priority and traditional rate limit data)
await adaptiveStore.cleanup();

// Close database connection
await adaptiveStore.close();
```

## Performance Characteristics

- **Persistence**: Data survives application restarts and crashes
- **Concurrency**: SQLite handles concurrent access with appropriate locking
- **Memory**: Lower memory usage compared to in-memory stores
- **Latency**: Slightly higher latency due to disk I/O
- **Scalability**: Suitable for moderate to high traffic applications

## Use Cases

Perfect for:

- Production applications
- Multi-instance deployments
- Long-running processes
- Applications requiring data persistence
- Serverless environments with persistent storage
- Docker containers with volume mounts

## Dependencies

- `drizzle-orm`: Type-safe SQL query builder
- `better-sqlite3`: Fast SQLite3 binding for Node.js

## License

MIT
