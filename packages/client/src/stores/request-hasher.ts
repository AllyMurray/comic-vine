import { createHash } from 'crypto';

/**
 * Creates a consistent hash for API requests to use as cache/dedupe keys
 * @param endpoint The API endpoint
 * @param params The request parameters
 * @returns A SHA-256 hash of the request
 */
export function hashRequest(
  endpoint: string,
  params: Record<string, unknown> = {},
): string {
  const requestString = JSON.stringify({
    endpoint,
    params: sortObject(params),
  });

  return createHash('sha256').update(requestString).digest('hex');
}

/**
 * Normalises and sorts an object for hashing purposes.
 *
 * The ComicVine API transmits all query parameters as strings. To avoid cache
 * misses caused by treating `10` and `'10'` as different values we normalise
 * primitive types (number and boolean) to their string representation **before**
 * sorting. `undefined` values are intentionally kept as `undefined` so that
 * they are dropped by `JSON.stringify`, maintaining the existing behaviour
 * where an omitted parameter and an `undefined` parameter produce the same
 * hash.
 */
function sortObject(obj: unknown): unknown {
  // Handle primitives first
  if (obj === null) {
    return null;
  }

  const objType = typeof obj;

  if (objType === 'undefined' || objType === 'string') {
    return obj;
  }

  if (objType === 'number' || objType === 'boolean') {
    // Convert to string so that 10 and '10' (or true and 'true') hash equally
    return String(obj);
  }

  // Recursively process arrays
  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  }

  // For objects – sort keys and recurse
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();

  for (const key of keys) {
    const value = (obj as Record<string, unknown>)[key];
    const normalisedValue = sortObject(value);

    // Skip keys whose value normalises to undefined so omitted & undefined match
    if (normalisedValue !== undefined) {
      sorted[key] = normalisedValue;
    }
  }

  return sorted;
}
