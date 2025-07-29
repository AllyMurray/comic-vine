import { MAX_ITEM_SIZE_BYTES } from './constants.js';
import { DynamoDBStoreError, ItemSizeError } from './types.js';

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
