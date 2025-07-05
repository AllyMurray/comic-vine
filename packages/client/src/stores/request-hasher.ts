import { createHash } from 'crypto';

/**
 * Creates a consistent hash for API requests to use as cache/dedupe keys
 * @param endpoint The API endpoint
 * @param params The request parameters
 * @returns A SHA-256 hash of the request
 */
export function hashRequest(
  endpoint: string,
  params: Record<string, any> = {},
): string {
  const requestString = JSON.stringify({
    endpoint,
    params: sortObject(params),
  });

  return createHash('sha256').update(requestString).digest('hex');
}

/**
 * Recursively sorts object keys for consistent hashing
 * @param obj The object to sort
 * @returns The sorted object
 */
function sortObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  }

  const sorted: Record<string, any> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = sortObject(obj[key]);
  }

  return sorted;
}
