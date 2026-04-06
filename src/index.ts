import { ComicVine } from './comic-vine.js';
import { StatusCode } from './http-client/status-code.js';

export default ComicVine;

// Named exports for better tree-shaking
export { ComicVine };

// Export all error types
export * from './errors/index.js';

// Export all types
export * from './types/index.js';

// Export Comic Vine specific HTTP utilities
export { StatusCode };

// Re-export client options
export type { ComicVineOptions } from './comic-vine.js';
