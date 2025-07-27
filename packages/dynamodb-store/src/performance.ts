import type { DynamoDBStoreConfig } from './types.js';

/**
 * Configuration for parallel processing operations
 */
export interface ParallelProcessingConfig {
  /**
   * Maximum number of concurrent operations
   * @default 10
   */
  maxConcurrency?: number;

  /**
   * Batch size for batch operations
   * @default 25 (DynamoDB limit)
   */
  batchSize?: number;

  /**
   * Delay between batches in milliseconds
   * @default 0
   */
  batchDelayMs?: number;
}

/**
 * Execute operations in parallel with concurrency control
 */
export async function executeInParallel<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  config: ParallelProcessingConfig = {},
): Promise<R[]> {
  const maxConcurrency = config.maxConcurrency ?? 10;
  
  if (items.length === 0) {
    return [];
  }

  if (maxConcurrency >= items.length) {
    // No need for concurrency control
    return Promise.all(items.map(operation));
  }

  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const executeItem = operation(items[i]).then((result) => {
      results[i] = result;
    });

    executing.push(executeItem);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      // Remove completed promises
      const stillExecuting = executing.filter(
        (promise) => (promise as any)[Symbol.toStringTag] !== 'resolved',
      );
      executing.length = 0;
      executing.push(...stillExecuting);
    }
  }

  // Wait for all remaining operations to complete
  await Promise.all(executing);

  return results;
}

/**
 * Execute operations in controlled batches with optional delays
 */
export async function executeInBatches<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R[]>,
  config: ParallelProcessingConfig = {},
): Promise<R[]> {
  const batchSize = config.batchSize ?? 25;
  const batchDelayMs = config.batchDelayMs ?? 0;

  if (items.length === 0) {
    return [];
  }

  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await operation(batch);
    results.push(...batchResults);

    // Add delay between batches if configured
    if (batchDelayMs > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }

  return results;
}

/**
 * Pool of reusable promises for managing concurrent operations
 */
export class PromisePool {
  private readonly pool: Array<() => Promise<any>> = [];
  private readonly maxConcurrency: number;
  private activeCount = 0;

  constructor(maxConcurrency = 10) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Add a promise factory to the pool
   */
  add<T>(promiseFactory: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pool.push(async () => {
        try {
          const result = await promiseFactory();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  /**
   * Wait for all promises in the pool to complete
   */
  async drain(): Promise<void> {
    while (this.pool.length > 0 || this.activeCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private async process(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency || this.pool.length === 0) {
      return;
    }

    const promiseFactory = this.pool.shift();
    if (!promiseFactory) {
      return;
    }

    this.activeCount++;

    try {
      await promiseFactory();
    } finally {
      this.activeCount--;
      this.process(); // Process next item in queue
    }
  }
}

/**
 * Optimized batch writer for DynamoDB operations
 */
export class BatchWriter<T> {
  private readonly items: T[] = [];
  private readonly config: DynamoDBStoreConfig;
  private readonly batchOperation: (items: T[]) => Promise<void>;
  private readonly maxBatchSize: number;

  constructor(
    config: DynamoDBStoreConfig,
    batchOperation: (items: T[]) => Promise<void>,
    maxBatchSize = 25,
  ) {
    this.config = config;
    this.batchOperation = batchOperation;
    this.maxBatchSize = Math.min(maxBatchSize, config.batchSize);
  }

  /**
   * Add an item to the batch
   */
  add(item: T): void {
    this.items.push(item);
  }

  /**
   * Flush all items in batches
   */
  async flush(): Promise<void> {
    if (this.items.length === 0) {
      return;
    }

    const batches: T[][] = [];
    for (let i = 0; i < this.items.length; i += this.maxBatchSize) {
      batches.push(this.items.slice(i, i + this.maxBatchSize));
    }

    // Execute batches in parallel with controlled concurrency
    await executeInParallel(
      batches,
      this.batchOperation,
      { maxConcurrency: 5 }, // Limit concurrent batch operations
    );

    // Clear items after successful flush
    this.items.length = 0;
  }

  /**
   * Get current batch size
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Check if batch is ready to flush
   */
  isReady(): boolean {
    return this.items.length >= this.maxBatchSize;
  }
}

/**
 * Adaptive delay calculator for rate limiting
 */
export class AdaptiveDelayCalculator {
  private readonly recentDelays: number[] = [];
  private readonly maxSamples = 10;
  private readonly baseDelayMs: number;

  constructor(baseDelayMs = 100) {
    this.baseDelayMs = baseDelayMs;
  }

  /**
   * Calculate next delay based on recent performance
   */
  getNextDelay(wasThrottled = false): number {
    if (wasThrottled) {
      // Increase delay when throttled
      const currentDelay = this.recentDelays.length > 0 
        ? this.recentDelays[this.recentDelays.length - 1]
        : this.baseDelayMs;
      
      const nextDelay = Math.min(currentDelay * 2, 5000); // Cap at 5 seconds
      this.addDelay(nextDelay);
      return nextDelay;
    } else {
      // Decrease delay when successful
      const currentDelay = this.recentDelays.length > 0 
        ? this.recentDelays[this.recentDelays.length - 1]
        : this.baseDelayMs;
      
      const nextDelay = Math.max(currentDelay * 0.9, this.baseDelayMs);
      this.addDelay(nextDelay);
      return nextDelay;
    }
  }

  /**
   * Get average delay from recent samples
   */
  getAverageDelay(): number {
    if (this.recentDelays.length === 0) {
      return this.baseDelayMs;
    }

    const sum = this.recentDelays.reduce((acc, delay) => acc + delay, 0);
    return sum / this.recentDelays.length;
  }

  private addDelay(delay: number): void {
    this.recentDelays.push(delay);
    
    if (this.recentDelays.length > this.maxSamples) {
      this.recentDelays.shift();
    }
  }
}