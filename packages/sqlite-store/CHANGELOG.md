# @comic-vine/sqlite-store

## 0.1.2

### Patch Changes

- 16cbc6b: update documentation detailing how stores work
- Updated dependencies [16cbc6b]
  - @comic-vine/client@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [6d7fcb9]
  - @comic-vine/client@0.1.1

## 0.1.0

### Minor Changes

- ce26fb2: feat: introduce @comic-vine/in-memory-store and @comic-vine/sqlite-store packages

  This introduces two new packages providing optimized store implementations for caching, deduplication, and rate limiting:
  - @comic-vine/in-memory-store: Advanced in-memory stores with LRU eviction and memory management
  - @comic-vine/sqlite-store: SQLite-based persistent stores with cross-process support and database optimization

  Both packages provide comprehensive TypeScript support and are designed for production use.

### Patch Changes

- Updated dependencies [ce26fb2]
  - @comic-vine/client@0.1.0
