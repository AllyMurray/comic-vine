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
if (
  typeof module !== 'undefined' &&
  module.exports &&
  // Only mutate if the export object is mutable and `default` is not already defined.
  typeof module.exports === 'object' &&
  !Object.prototype.hasOwnProperty.call(module.exports, 'default')
) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore – intentional CommonJS interop assignment
  module.exports = ComicVine;
  // Re-add named exports for consumers relying on them
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  module.exports.default = ComicVine;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  module.exports.ComicVine = ComicVine;
}
