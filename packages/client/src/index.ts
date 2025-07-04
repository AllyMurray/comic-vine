import { ComicVine } from './comic-vine.js';

export default ComicVine;

// @ts-expect-error silence error:
// Export assignment cannot be used when targeting ECMAScript modules.
// Without this consumers using commonjs will need to do:
//   const ComicVine = require('./comic-vine.js').default;
// Rather than:
//   const ComicVine = require('./comic-vine.js');
export = ComicVine;
