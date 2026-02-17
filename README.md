# Comic Vine SDK

A TypeScript client library for the [Comic Vine API](https://comicvine.gamespot.com/api/) with built-in caching, deduplication, and rate limiting. HTTP, caching, deduplication, and rate limiting are delegated to [`@http-client-toolkit/core`](https://github.com/AllyMurray/http-client-toolkit).

## Features

- **Type-safe API** with detailed type definitions for all 19 Comic Vine resources
- **Field selection** with automatic TypeScript type narrowing
- **Automatic pagination** via async iteration
- **Caching, deduplication, and rate limiting** via `@http-client-toolkit/core`
- **Comprehensive error handling** with domain-specific error types

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

// Auto pagination
for await (const issue of client.issue.list({ filter: { volume: 796 } })) {
  console.log(issue.name);
}
```

## Documentation

Full documentation is available at **[allymurray.github.io/comic-vine](https://allymurray.github.io/comic-vine)**, including:

- [Getting Started](https://allymurray.github.io/comic-vine/getting-started/introduction/) - Installation, configuration, and quick start
- [Guides](https://allymurray.github.io/comic-vine/guides/field-selection/) - Field selection, filtering, pagination, caching, and rate limiting
- [API Reference](https://allymurray.github.io/comic-vine/api/resources/) - All 19 resources with full TypeScript interfaces
- [Examples](https://allymurray.github.io/comic-vine/examples/basic-usage/) - Basic and advanced usage patterns

## Code Generation

Resource types, classes, tests, and mock data are generated from sample API responses.

```bash
# Generate all types, resource classes, tests, and mock data from samples
pnpm sdk:generate

# Format generated output to match project style
pnpm format
```

### Fetching Fresh API Samples

```bash
# Requires COMIC_VINE_API_KEY environment variable
COMIC_VINE_API_KEY=your-key pnpm samples:fetch
```

### How It Works

1. Sample API responses are stored in `samples/api-data/` (38 folders, one per resource type)
2. `scripts/generate-sdk.ts` orchestrates the pipeline:
   - Infers a type graph from sample JSON (types, nullable fields, arrays, enums, index signatures)
   - Injects property descriptions from scraped API documentation
   - Generates TypeScript interfaces with common type replacement
   - Generates resource classes, tests, barrel files, and mock data
3. All generator modules in `scripts/generate-sdk/` are pure functions (no I/O)
4. Running `pnpm sdk:generate && pnpm format` produces deterministic output matching the committed code

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT - see [LICENSE](LICENSE) for details.
