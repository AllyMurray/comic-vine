import type { InferredTypeGraph, InferredType } from './types.js';

/**
 * Fields removed because the API never populates them. Confirmed by
 * exhaustively scanning every record via the list API.
 *
 * - movie.distributor: null across all 2,982 movies
 * - video.savedTime: null across all 3,119 videos
 * - video.videoShow: null across all 3,119 videos
 */
const REMOVED_FIELDS = new Set(['distributor', 'savedTime', 'videoShow']);

/**
 * Apply known type overrides for properties where sample data is ambiguous.
 *
 * - hasStaffReview: can be null, false, or a SiteResource object — samples
 *   don't always include all variants
 * - aliases: can be null or a newline-delimited string — quicktype sometimes
 *   misidentifies null-only samples
 * - characterSet: always null across all 10 origin records in the API.
 *   The origin dataset is a closed set of 10 entries (Mutant, Cyborg, Alien,
 *   Human, Robot, Radiation, God/Eternal, Animal, Other, Infection). Despite
 *   the name suggesting an array of characters, the API never populates this
 *   field — the `characters` property (Array<ApiResource>) serves that purpose
 *   instead. Typed as null since no non-null sample exists anywhere in the API.
 */
export function applyTypeOverrides(graph: InferredTypeGraph): void {
  graph.rootType.properties = graph.rootType.properties.filter(
    (prop) => !REMOVED_FIELDS.has(prop.name),
  );

  for (const prop of graph.rootType.properties) {
    if (prop.name === 'hasStaffReview') {
      prop.type = {
        kind: 'union',
        members: [
          { kind: 'null' },
          { kind: 'literal', value: false },
          { kind: 'commonType', typeName: 'SiteResource' },
        ],
      };
    }

    if (prop.name === 'aliases') {
      prop.type = {
        kind: 'union',
        members: [{ kind: 'null' }, { kind: 'primitive', type: 'string' }],
      };
    }

    if (prop.name === 'characterSet') {
      prop.type = { kind: 'null' };
    }
  }
}
