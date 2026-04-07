---
'comic-vine-sdk': major
---

Rewrite as a single-package SDK built on `@http-client-toolkit/core` for HTTP requests, with toolkit-compatible caching, deduplication, and rate limiting stores.

**Breaking changes:**

- Package renamed from `@comic-vine/client` to `comic-vine-sdk`
- Replaced the monorepo package layout with a single published SDK package
- HTTP layer replaced: custom Axios-based client → `@http-client-toolkit/core` (fetch-based)
- Store interfaces now use `CacheStore`, `DedupeStore`, and `RateLimitStore` from `@http-client-toolkit/core`
- Constructor accepts a single `ComicVineOptions` object with `apiKey`, `baseUrl`, `stores`, and `client` fields
- Resource properties are lazily loaded via Proxy

**New features:**

- Full code generation pipeline: types, resources, tests, and mock data generated from API samples
- All 19 Comic Vine resources with typed `list()` and `retrieve()` methods
- `list()` returns a dual `Promise & AsyncIterable` for automatic pagination
- Utility methods: `getAvailableResources`, `hasResource`, `clearCache`, `getCacheStats`, `getRateLimitStatus`, `resetRateLimit`
- Comprehensive build artifact tests: ESM, CJS, exports, functionality, browser bundleability, type contracts, bundle size gating
