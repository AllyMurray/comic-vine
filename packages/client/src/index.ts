import { ComicVine } from './comic-vine.js';

export default ComicVine;

// Named exports for better tree-shaking
export { ComicVine };

// Re-export all error types
export * from './errors/index.js';

// Re-export store interfaces and types
export * from './stores/index.js';

// Re-export client options and store types
export type { StoreOptions, ComicVineClientOptions } from './comic-vine.js';

// CommonJS compatibility - ensure require('@comic-vine/client') works without .default
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComicVine;
  module.exports.default = ComicVine;
  module.exports.ComicVine = ComicVine;
}
