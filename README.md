# Comic Vine API Client

A TypeScript client library for the Comic Vine API with built-in caching, deduplication, and rate limiting. The API provides full access to the structured-wiki content with type-safe interfaces and advanced optimization features.

## Table of Contents

- [Installation](#installation)
- [Comic Vine Resources](#comic-vine-resources)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Basic Configuration](#basic-configuration)
  - [With Custom Stores](#with-custom-stores)
- [API Reference](#api-reference)
  - [Resources](#resources)
  - [Fetch a Single Resource](#fetch-a-single-resource)
  - [Fetch a Resource List](#fetch-a-resource-list)
  - [Field Selection](#field-selection)
  - [Filtering](#filtering)
  - [Pagination](#pagination)
    - [Manual Pagination](#manual-pagination)
    - [Auto Pagination](#auto-pagination)
- [Advanced Usage](#advanced-usage)
- [Store Implementations](#store-implementations)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

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
# or
yarn add @comic-vine/client
# or
pnpm add @comic-vine/client
```

### Optional Store Packages

The client works without any stores by default (no caching, deduplication, or rate limiting). Install store packages to enable these optimization features:

```bash
# For advanced in-memory stores with LRU eviction and memory management
npm install @comic-vine/in-memory-store

# For SQLite-based persistent stores (recommended for production)
npm install @comic-vine/sqlite-store
```

### TypeScript Support

This library is written in TypeScript and provides comprehensive type definitions:

- **Full type safety** for all Comic Vine resources and fields
- **Intelligent field selection** with automatic type narrowing
- **Auto-completion** for all methods, parameters, and response properties
- **Filter validation** with type-safe filter options per resource

The types are generated from the actual Comic Vine API responses, ensuring accuracy and up-to-date definitions. If you encounter any type issues, please [open an issue](https://github.com/AllyMurray/comic-vine/issues/new) with the details.

## Comic Vine Resources

[Complete Comic Vine resources documentation](https://comicvine.gamespot.com/api/documentation)

The library exposes an object for each Comic Vine resource. The object names are singular and expose a `retrieve()` method that maps to the singular resource endpoint and a `list()` method that maps to the plural resource endpoint.

The following table lists all implemented resources and how the `retrieve` and `list` methods map to the Comic Vine API. Most resources are direct mappings, but `object` has been mapped to `thing` since `object` is a reserved word in JavaScript and `thing` matches the Comic Vine wiki terminology.

| Library Resource | Retrieve Method API Endpoint                                                | List Method API Endpoint                                                      |
| ---------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| character        | [character](https://comicvine.gamespot.com/api/documentation#toc-0-2)       | [characters](https://comicvine.gamespot.com/api/documentation#toc-0-3)        |
| concept          | [concept](https://comicvine.gamespot.com/api/documentation#toc-0-6)         | [concepts](https://comicvine.gamespot.com/api/documentation#toc-0-7)          |
| episode          | [episode](https://comicvine.gamespot.com/api/documentation#toc-0-8)         | [episodes](https://comicvine.gamespot.com/api/documentation#toc-0-9)          |
| issue            | [issue](https://comicvine.gamespot.com/api/documentation#toc-0-10)          | [issues](https://comicvine.gamespot.com/api/documentation#toc-0-11)           |
| location         | [location](https://comicvine.gamespot.com/api/documentation#toc-0-12)       | [locations](https://comicvine.gamespot.com/api/documentation#toc-0-13)        |
| movie            | [movie](https://comicvine.gamespot.com/api/documentation#toc-0-14)          | [movies](https://comicvine.gamespot.com/api/documentation#toc-0-15)           |
| origin           | [origin](https://comicvine.gamespot.com/api/documentation#toc-0-18)         | [origins](https://comicvine.gamespot.com/api/documentation#toc-0-19)          |
| person           | [person](https://comicvine.gamespot.com/api/documentation#toc-0-20)         | [people](https://comicvine.gamespot.com/api/documentation#toc-0-21)           |
| power            | [power](https://comicvine.gamespot.com/api/documentation#toc-0-22)          | [powers](https://comicvine.gamespot.com/api/documentation#toc-0-23)           |
| promo            | [promo](https://comicvine.gamespot.com/api/documentation#toc-0-24)          | [promos](https://comicvine.gamespot.com/api/documentation#toc-0-25)           |
| publisher        | [publisher](https://comicvine.gamespot.com/api/documentation#toc-0-26)      | [publishers](https://comicvine.gamespot.com/api/documentation#toc-0-27)       |
| series           | [series](https://comicvine.gamespot.com/api/documentation#toc-0-28)         | [series_list](https://comicvine.gamespot.com/api/documentation#toc-0-29)      |
| storyArc         | [story_arc](https://comicvine.gamespot.com/api/documentation#toc-0-31)      | [story_arcs](https://comicvine.gamespot.com/api/documentation#toc-0-32)       |
| team             | [team](https://comicvine.gamespot.com/api/documentation#toc-0-33)           | [teams](https://comicvine.gamespot.com/api/documentation#toc-0-34)            |
| thing            | [object](https://comicvine.gamespot.com/api/documentation#toc-0-16)         | [objects](https://comicvine.gamespot.com/api/documentation#toc-0-17)          |
| video            | [video](https://comicvine.gamespot.com/api/documentation#toc-0-36)          | [videos](https://comicvine.gamespot.com/api/documentation#toc-0-37)           |
| videoCategory    | [video_category](https://comicvine.gamespot.com/api/documentation#toc-0-40) | [video_categories](https://comicvine.gamespot.com/api/documentation#toc-0-41) |
| videoType        | [video_type](https://comicvine.gamespot.com/api/documentation#toc-0-38)     | [video_types](https://comicvine.gamespot.com/api/documentation#toc-0-39)      |
| volume           | [volume](https://comicvine.gamespot.com/api/documentation#toc-0-42)         | [volumes](https://comicvine.gamespot.com/api/documentation#toc-0-43)          |

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
  baseUrl: 'https://comicvine.gamespot.com/api', // Default - usually not needed
  client: {
    defaultCacheTTL: 3600, // 1 hour cache TTL
    throwOnRateLimit: true, // Throw errors on rate limits
    maxWaitTime: 60000, // Max wait time for rate limits
  },
});
```

#### Custom Base URL

The `baseUrl` option allows you to customize the API endpoint. This is primarily useful for:

- **Proxy servers**: Route requests through a CORS proxy for browser usage
- **API gateways**: Use custom API gateway endpoints
- **Testing**: Point to mock servers during development

**Browser Usage with CORS Proxy:**

```typescript
// The Comic Vine API doesn't support CORS for browser requests
// You'll need a proxy server to make requests from browsers
const client = new ComicVine({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-proxy-server.com/api/',
});

// Note: Never expose your API key in browser JavaScript
// The proxy should handle API key injection server-side
```

**Custom API Gateway:**

```typescript
const client = new ComicVine({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.yourcompany.com/comicvine/',
});
```

### With Store Packages

To enable caching, deduplication, and rate limiting, install and configure store packages:

#### In-Memory Stores

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

All Comic Vine resources follow consistent patterns. See the TypeScript definitions in `packages/client/src/resources/` for detailed type information and available methods.

### Fetch a Single Resource

All resources have a `retrieve()` method that accepts an ID and optional configuration:

```typescript
// Basic retrieve
const issue = await client.issue.retrieve(12345);

// Retrieve with field selection (type-safe)
const issue = await client.issue.retrieve(12345, {
  fieldList: ['id', 'name', 'issueNumber', 'coverDate'],
});

// TypeScript automatically narrows the return type to only include selected fields
console.log(issue.name); // ✅ Available - included in fieldList
console.log(issue.description); // ❌ TypeScript error - not in fieldList
```

### Fetch a Resource List

All resources have a `list()` method that supports filtering, pagination, and field selection:

```typescript
// Basic list (returns first page)
const issues = await client.issue.list();
console.log(issues.results); // Array of issues
console.log(issues.totalCount); // Total count of all results

// List with options
const issues = await client.issue.list({
  fieldList: ['id', 'name', 'issueNumber'],
  filter: { volume: 12345 },
  limit: 50,
  offset: 0,
  sort: { field: 'issueNumber', direction: 'asc' },
});
```

### Field Selection

When making requests, you often only need specific properties. Both `retrieve()` and `list()` methods accept a `fieldList` option for this purpose.

**TypeScript Benefits:** Field selection is completely type-safe. The return type is automatically narrowed to only include the selected fields, providing accurate IntelliSense and compile-time validation.

```typescript
// Example: Get only basic issue information
const issue = await client.issue.retrieve(12345, {
  fieldList: ['id', 'name', 'issueNumber', 'coverDate', 'volume'],
});

// TypeScript knows exactly what fields are available
console.log(issue.id); // ✅ number
console.log(issue.name); // ✅ string
console.log(issue.issueNumber); // ✅ number
console.log(issue.description); // ❌ TypeScript error - not selected

// Works the same way for lists
const characters = await client.character.list({
  fieldList: ['id', 'name', 'image', 'publisher'],
  filter: { name: 'Spider-Man' },
});

// Each character in the results only has the selected fields
characters.results.forEach((character) => {
  console.log(character.name); // ✅ Available
  console.log(character.description); // ❌ TypeScript error
});
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

The Comic Vine API provides offset-based pagination. The client supports both manual pagination and automatic pagination through async iteration.

#### Manual Pagination

Control pagination explicitly using `limit` and `offset` parameters:

```typescript
const limit = 50;
const filter = { volume: 12345 };

// Get the first page (issues 1-50)
const page1 = await client.issue.list({
  limit,
  filter,
  offset: 0,
});
console.log(`Page 1: ${page1.results.length} issues`);
console.log(`Total available: ${page1.totalCount}`);

// Get the second page (issues 51-100)
const page2 = await client.issue.list({
  limit,
  filter,
  offset: 50,
});
console.log(`Page 2: ${page2.results.length} issues`);

// Calculate pagination info
const totalPages = Math.ceil(page1.totalCount / limit);
console.log(`Total pages: ${totalPages}`);
```

#### Auto Pagination

Use `for await...of` to automatically iterate through all results across multiple pages:

```typescript
// Iterate through ALL issues in a volume (automatic pagination)
const filter = { volume: 12345 };
const issueNames = [];

for await (const issue of client.issue.list({ filter, limit: 50 })) {
  issueNames.push(issue.name);

  // The loop automatically fetches new pages as needed
  // No need to manage offset manually
}

console.log(`Found ${issueNames.length} total issues`);
console.log(issueNames);
```

**Auto Pagination Features:**

- Automatically fetches subsequent pages when current page is exhausted
- Works with any filter or field selection options
- Memory efficient - processes one item at a time
- Respects rate limits and caching automatically

```typescript
// Complex example: Find all Spider-Man characters with auto-pagination
const spiderCharacters = [];

for await (const character of client.character.list({
  fieldList: ['id', 'name', 'publisher', 'image'],
  filter: { name: 'Spider' }, // Partial name match
  limit: 100, // Larger pages for efficiency
})) {
  if (character.name.toLowerCase().includes('spider')) {
    spiderCharacters.push({
      id: character.id,
      name: character.name,
      publisher: character.publisher?.name,
    });
  }
}

console.log(`Found ${spiderCharacters.length} Spider characters`);
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

- `rate-limited-client-usage.ts` - Rate limiting examples with per-resource configuration and error handling
- `memory-managed-cache-usage.ts` - Memory-managed caching examples with LRU eviction and statistics monitoring

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT - see [LICENSE](LICENSE) for details.
