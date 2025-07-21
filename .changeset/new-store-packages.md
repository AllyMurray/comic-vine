---
'@comic-vine/client': minor
'@comic-vine/in-memory-store': minor
'@comic-vine/sqlite-store': minor
---

feat: introduce @comic-vine/in-memory-store and @comic-vine/sqlite-store packages

This introduces two new packages providing optimized store implementations for caching, deduplication, and rate limiting:

- @comic-vine/in-memory-store: Advanced in-memory stores with LRU eviction and memory management
- @comic-vine/sqlite-store: SQLite-based persistent stores with cross-process support and database optimization

Both packages provide comprehensive TypeScript support and are designed for production use.
