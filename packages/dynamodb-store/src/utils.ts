import { DynamoDBStoreError, ItemSizeError } from './types.js';

/**
 * Maximum item size for DynamoDB (400KB)
 */
export const MAX_ITEM_SIZE_BYTES = 400 * 1024;

/**
 * Default TTL for dedupe operations (5 minutes)
 */
export const DEFAULT_DEDUPE_TTL_SECONDS = 5 * 60;

/**
 * Calculate TTL timestamp from seconds
 */
export function calculateTTL(ttlSeconds: number): number {
  if (ttlSeconds <= 0) {
    return Math.floor(Date.now() / 1000); // Immediate expiration
  }
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

/**
 * Check if an item has expired based on TTL
 */
export function isExpired(ttl: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= ttl;
}

/**
 * Serialize value to JSON string with size checking
 */
export function serializeValue(value: unknown): string {
  let serialized: string;

  try {
    if (value === undefined) {
      serialized = '__UNDEFINED__';
    } else {
      serialized = JSON.stringify(value);
    }
  } catch (error) {
    throw new DynamoDBStoreError(
      `Failed to serialize value: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
      'serialize',
    );
  }

  const sizeBytes = Buffer.byteLength(serialized, 'utf8');
  if (sizeBytes > MAX_ITEM_SIZE_BYTES) {
    throw new ItemSizeError(sizeBytes, MAX_ITEM_SIZE_BYTES);
  }

  return serialized;
}

/**
 * Deserialize JSON string to value
 */
export function deserializeValue<T>(serialized: string): T | undefined {
  try {
    if (serialized === '__UNDEFINED__') {
      return undefined;
    }
    return JSON.parse(serialized) as T;
  } catch (error) {
    throw new DynamoDBStoreError(
      `Failed to deserialize value: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
      'deserialize',
    );
  }
}

/**
 * Sleep for specified milliseconds with optional jitter
 */
export function sleep(ms: number, jitter = 0): Promise<void> {
  const actualMs = jitter > 0 ? ms + Math.random() * jitter : ms;
  return new Promise((resolve) => setTimeout(resolve, actualMs));
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs = 30000,
): number {
  const exponentialDelay = Math.min(
    baseDelayMs * Math.pow(2, attempt),
    maxDelayMs,
  );
  const jitter = exponentialDelay * 0.1 * Math.random(); // 10% jitter
  return exponentialDelay + jitter;
}

/**
 * Check if an error is a throttling error from DynamoDB
 */
export function isThrottlingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { name?: string; code?: string };
  return (
    err.name === 'ThrottlingException' ||
    err.name === 'ProvisionedThroughputExceededException' ||
    err.name === 'ThrottlingError' ||
    err.code === 'ThrottlingException' ||
    err.code === 'ProvisionedThroughputExceededException'
  );
}

/**
 * Check if an error is a conditional check failed error
 */
export function isConditionalCheckFailedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { name?: string; code?: string };
  return (
    err.name === 'ConditionalCheckFailedException' ||
    err.code === 'ConditionalCheckFailedException'
  );
}

/**
 * Chunk an array into smaller arrays of specified size
 */
export function chunkArray<T>(
  array: Array<T>,
  chunkSize: number,
): Array<Array<T>> {
  const chunks: Array<Array<T>> = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Check if error should trigger circuit breaker
 */
export function isSevereError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { name?: string; code?: string; statusCode?: number };

  // Service unavailable errors
  if (
    err.name === 'ServiceUnavailable' ||
    err.code === 'ServiceUnavailable' ||
    err.statusCode === 503
  ) {
    return true;
  }

  // Internal server errors
  if (
    err.name === 'InternalServerError' ||
    err.code === 'InternalServerError' ||
    err.statusCode === 500
  ) {
    return true;
  }

  // Connection timeout errors
  if (
    err.name === 'TimeoutError' ||
    err.name === 'ConnectTimeoutError' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ENOTFOUND'
  ) {
    return true;
  }

  // Throttling errors should trigger circuit breaker
  if (isThrottlingError(err)) {
    return true;
  }

  return false;
}

/**
 * Calculate optimal batch size based on item size and DynamoDB limits
 */
export function calculateOptimalBatchSize(
  averageItemSizeBytes: number,
  maxBatchSize = 25,
): number {
  const maxRequestSizeBytes = 16 * 1024 * 1024; // 16MB DynamoDB limit
  const calculatedSize = Math.floor(maxRequestSizeBytes / averageItemSizeBytes);

  return Math.min(calculatedSize, maxBatchSize);
}

/**
 * Measure operation execution time
 */
export async function measureExecutionTime<T>(
  operation: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const startTime = performance.now();
  const result = await operation();
  const endTime = performance.now();

  return {
    result,
    durationMs: endTime - startTime,
  };
}
