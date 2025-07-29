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
