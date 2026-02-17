import type { InferredTypeGraph, InferredType } from './types.js';

/**
 * Apply known type overrides for properties where sample data is ambiguous.
 *
 * - hasStaffReview: can be null, false, or a SiteResource object — samples
 *   don't always include all variants
 * - aliases: can be null or a newline-delimited string — quicktype sometimes
 *   misidentifies null-only samples
 */
export function applyTypeOverrides(graph: InferredTypeGraph): void {
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
  }
}
