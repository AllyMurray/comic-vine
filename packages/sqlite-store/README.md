# @comic-vine/sqlite-store

SQLite store implementations for Comic Vine client caching, deduplication, and rate limiting using Drizzle ORM.

## Installation

```bash
npm install @comic-vine/sqlite-store @comic-vine/client
```

## Usage

```typescript
import { RateLimitedComicVineClient } from '@comic-vine/client';
import {
  SQLiteCacheStore,
  SQLiteDedupeStore,
  SQLiteRateLimitStore,
} from '@comic-vine/sqlite-store';

const client = RateLimitedComicVineClient.create('your-api-key', {
  cache: new SQLiteCacheStore('./cache.db'),
  dedupe: new SQLiteDedupeStore('./dedupe.db'),
  rateLimit: new SQLiteRateLimitStore('./rate-limits.db'),
});

// Use client normally - data persists across application restarts
const issue = await client.issue.retrieve(1);
```

## Store Implementations

### SQLiteCacheStore

Provides persistent caching with TTL support using SQLite database.

```typescript
const cacheStore = new SQLiteCacheStore(
  './cache.db', // Database file path (':memory:' for in-memory)
  {
    cleanupIntervalMs: 60000, // Cleanup expired items every minute
  },
);
```

**Features:**

- Persistent storage across application restarts
- TTL-based expiration with automatic cleanup
- Database-level ACID transactions
- Efficient indexing for fast lookups
- Automatic schema creation and migration

### SQLiteDedupeStore

Prevents duplicate concurrent requests using SQLite for coordination.

```typescript
const dedupeStore = new SQLiteDedupeStore('./dedupe.db', {
  jobTimeoutMs: 300000, // 5 minute timeout for jobs
});
```

**Features:**

- Cross-process deduplication support
- Persistent job state tracking
- Automatic cleanup of expired jobs
- Promise-based waiting with database coordination
- Error state persistence and recovery

### SQLiteRateLimitStore

Implements sliding window rate limiting with SQLite persistence.

```typescript
const rateLimitStore = new SQLiteRateLimitStore(
  './rate-limits.db',
  { limit: 100, windowMs: 60000 }, // Default: 100 requests per minute
  new Map([
    ['issues', { limit: 50, windowMs: 60000 }], // Custom limits per resource
    ['characters', { limit: 200, windowMs: 60000 }],
  ]),
);
```

**Features:**

- Persistent rate limit tracking
- Per-resource configuration
- Sliding window algorithm
- Cross-process rate limit enforcement
- Automatic cleanup of expired records

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

### Performance Tuning

```typescript
// For high-throughput applications, consider separate databases
const stores = {
  cache: new SQLiteCacheStore('./data/cache.db', {
    cleanupIntervalMs: 300000, // Less frequent cleanup
  }),
  dedupe: new SQLiteDedupeStore('./data/dedupe.db', {
    jobTimeoutMs: 600000, // Longer timeout for slow operations
  }),
  rateLimit: new SQLiteRateLimitStore('./data/rate-limits.db'),
};
```

## Deployment Considerations

### Docker

```dockerfile
# Ensure SQLite files are persisted
VOLUME ["/app/data"]

# Your application
COPY . /app
WORKDIR /app

# Use persistent paths
ENV CACHE_DB_PATH=/app/data/cache.db
ENV DEDUPE_DB_PATH=/app/data/dedupe.db
ENV RATE_LIMIT_DB_PATH=/app/data/rate-limits.db
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
# Backup databases
cp cache.db cache.db.backup
cp dedupe.db dedupe.db.backup
cp rate-limits.db rate-limits.db.backup

# Vacuum databases to optimize performance
sqlite3 cache.db "VACUUM;"
sqlite3 dedupe.db "VACUUM;"
sqlite3 rate-limits.db "VACUUM;"
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
