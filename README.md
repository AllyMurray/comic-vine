# Comic Vine API Client

A TypeScript client library for the Comic Vine API with built-in caching, deduplication, and rate limiting.

## Features

- **Type-safe API**: Full TypeScript support with detailed type definitions
- **Caching**: Configurable caching with TTL support
- **Deduplication**: Prevents duplicate concurrent requests
- **Rate limiting**: Respects API rate limits with configurable policies
- **Pagination**: Automatic pagination support for list endpoints
- **Error handling**: Comprehensive error handling with custom error types
- **Extensible**: Plugin architecture for custom stores and middleware

## Installation

```bash
npm install @comic-vine/client
```

### Optional Store Packages

```bash
# For in-memory stores (default)
npm install @comic-vine/in-memory-store

# For SQLite-based persistent stores
npm install @comic-vine/sqlite-store
```

## Quick Start

```typescript
import ComicVine from '@comic-vine/client';

const client = new ComicVine({ apiKey: 'your-api-key' });

// Get a specific issue
const issue = await client.issue.retrieve(1);

// Search for characters
const characters = await client.character.list({
  filter: { name: 'Spider-Man' },
  limit: 10,
});

// Get character details
const character = await client.character.retrieve(1443);
```

## Configuration

### Basic Configuration

```typescript
import ComicVine from '@comic-vine/client';

const client = new ComicVine({
  apiKey: 'your-api-key',
  baseUrl: 'https://comicvine.gamespot.com/api', // Default
  client: {
    defaultCacheTTL: 3600, // 1 hour cache TTL
    throwOnRateLimit: true, // Throw errors on rate limits
    maxWaitTime: 60000, // Max wait time for rate limits
  },
});
```

### With Custom Stores

#### In-Memory Stores (Default)

```typescript
import ComicVine from '@comic-vine/client';
import {
  InMemoryCacheStore,
  InMemoryDedupeStore,
  InMemoryRateLimitStore,
} from '@comic-vine/in-memory-store';

const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    cache: new InMemoryCacheStore({
      maxSize: 1000,
      ttl: 300000, // 5 minutes
    }),
    dedupe: new InMemoryDedupeStore({
      jobTimeoutMs: 300000, // 5 minutes
    }),
    rateLimit: new InMemoryRateLimitStore({
      defaultConfig: { limit: 100, windowMs: 60000 }, // 100 requests per minute
    }),
  },
});
```

#### SQLite Stores (Persistent)

```typescript
import ComicVine from '@comic-vine/client';
import {
  SQLiteCacheStore,
  SQLiteDedupeStore,
  SQLiteRateLimitStore,
} from '@comic-vine/sqlite-store';

// Recommended: Use shared database for all stores
import Database from 'better-sqlite3';

const db = new Database('./comic-vine.db');

const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    cache: new SQLiteCacheStore({ database: db }),
    dedupe: new SQLiteDedupeStore({ database: db }),
    rateLimit: new SQLiteRateLimitStore({ database: db }),
  },
});
```

## API Reference

### Resources

All Comic Vine resources are available through the client:

```typescript
// Characters
await client.character.list(options);
await client.character.retrieve(id, options);

// Issues
await client.issue.list(options);
await client.issue.retrieve(id, options);

// Volumes
await client.volume.list(options);
await client.volume.retrieve(id, options);

// Publishers
await client.publisher.list(options);
await client.publisher.retrieve(id, options);

// And many more...
```

### Filtering

```typescript
// Filter by name
const characters = await client.character.list({
  filter: { name: 'Spider-Man' },
});

// Multiple filters
const issues = await client.issue.list({
  filter: {
    volume: 1234,
    issue_number: 1,
  },
});

// Date range filtering
const recentIssues = await client.issue.list({
  filter: {
    date_added: '2023-01-01 00:00:00|2023-12-31 23:59:59',
  },
});
```

### Pagination

```typescript
// Manual pagination
const page1 = await client.issue.list({ limit: 10, offset: 0 });
const page2 = await client.issue.list({ limit: 10, offset: 10 });

// Auto-pagination (fetches all results)
const allIssues = await client.issue.list({ autoPaginate: true });
```

### Field Selection

```typescript
// Only fetch specific fields
const characters = await client.character.list({
  fieldList: ['id', 'name', 'image'],
});
```

## Error Handling

The client provides detailed error types for different scenarios:

```typescript
import {
  UnauthorizedError,
  ObjectNotFoundError,
  FilterError,
  GenericRequestError,
} from '@comic-vine/client';

try {
  const issue = await client.issue.retrieve(999999);
} catch (error) {
  if (error instanceof UnauthorizedError) {
    console.error('Invalid API key');
  } else if (error instanceof ObjectNotFoundError) {
    console.error('Issue not found');
  } else if (error instanceof FilterError) {
    console.error('Invalid filter parameters');
  } else if (error instanceof GenericRequestError) {
    console.error('API request failed:', error.message);
  }
}
```

## Advanced Usage

### Custom Rate Limiting

```typescript
const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    rateLimit: new InMemoryRateLimitStore({
      defaultConfig: { limit: 200, windowMs: 60000 }, // Default: 200 requests per minute
      resourceConfigs: new Map([
        ['issues', { limit: 100, windowMs: 60000 }], // Issues: 100 req/min
        ['characters', { limit: 300, windowMs: 60000 }], // Characters: 300 req/min
      ]),
    }),
  },
});
```

### Custom Caching

```typescript
const client = new ComicVine({
  apiKey: 'your-api-key',
  stores: {
    cache: new InMemoryCacheStore({
      maxSize: 5000,
      ttl: 600000, // 10 minutes
      cleanupIntervalMs: 120000, // Cleanup every 2 minutes
    }),
  },
});
```

### Deduplication

```typescript
// Multiple simultaneous requests for the same resource
// will be deduplicated automatically
const [issue1, issue2, issue3] = await Promise.all([
  client.issue.retrieve(1),
  client.issue.retrieve(1), // Deduplicated
  client.issue.retrieve(1), // Deduplicated
]);
```

## Store Implementations

### In-Memory Stores

- **Pros**: Fastest performance, zero setup
- **Cons**: No persistence, single-process only
- **Use cases**: Development, testing, single-instance applications

### SQLite Stores

- **Pros**: Persistent across restarts, cross-process support
- **Cons**: Requires file system, slightly slower than in-memory
- **Use cases**: Production applications, multi-instance deployments

## Examples

See the `examples/` directory for complete usage examples:

- `basic-usage.ts` - Simple API usage
- `advanced-filtering.ts` - Complex filtering examples
- `custom-stores.ts` - Custom store implementations
- `error-handling.ts` - Comprehensive error handling

## API Documentation

For detailed API documentation, see the individual resource documentation:

- [Character API](packages/client/src/resources/character/README.md)
- [Issue API](packages/client/src/resources/issue/README.md)
- [Volume API](packages/client/src/resources/volume/README.md)
- [Publisher API](packages/client/src/resources/publisher/README.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT - see [LICENSE](LICENSE) for details.
