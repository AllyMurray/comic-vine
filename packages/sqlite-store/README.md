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
} from '@comic-vine/sqlite-store';

// Create ONE shared connection which every store will use.
const sharedDb = new Database('./comic-vine.db');

const client = new ComicVine('your-api-key', undefined, {
  cache: new SQLiteCacheStore({ database: sharedDb }),
  dedupe: new SQLiteDedupeStore({ database: sharedDb }),
  rateLimit: new SQLiteRateLimitStore({ database: sharedDb }),
});

// Use client normally - data persists across application restarts
const issue = await client.issue.retrieve(1);
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

## Shared Database Configuration

**Recommended**: Use a single database for all stores to reduce file handles and improve performance:

```typescript
import Database from 'better-sqlite3';

// Single database approach (recommended)
const db = new Database('./comic-vine-stores.db');

const stores = {
  cache: new SQLiteCacheStore({ database: db }),
  dedupe: new SQLiteDedupeStore({ database: db }),
  rateLimit: new SQLiteRateLimitStore({ database: db }),
};

// The stores automatically create their own tables within the shared database
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

```sql
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
```

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
} from '@comic-vine/sqlite-store';

// Type-safe configuration
const cacheOptions: SQLiteCacheStoreOptions = {
  database: './cache.db',
  cleanupIntervalMs: 120_000,
  maxEntrySizeBytes: 1024 * 1024, // 1MB
};

const cache = new SQLiteCacheStore(cacheOptions);
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

## Migration from Previous Versions

If upgrading from a version with positional constructor arguments:

```typescript
// Old positional syntax (no longer supported)
// new SQLiteCacheStore('./cache.db', { cleanupIntervalMs: 60000 })

// New object syntax
new SQLiteCacheStore({
  database: './cache.db',
  cleanupIntervalMs: 60_000,
});
```
