import { describe, it, expect, vi } from 'vitest';
import {
  executeInParallel,
  executeInBatches,
  PromisePool,
  BatchWriter,
  AdaptiveDelayCalculator,
} from './performance.js';
import { sleep } from './utils.js';

describe('performance utilities', () => {
  describe('executeInParallel', () => {
    it('should execute operations in parallel with concurrency control', async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const operation = vi.fn().mockImplementation(async (item) => {
        await sleep(10);
        return item * 2;
      });

      const start = Date.now();
      const results = await executeInParallel(items, operation, { maxConcurrency: 3 });
      const duration = Date.now() - start;

      expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
      expect(operation).toHaveBeenCalledTimes(10);
      
      // Should be faster than sequential but not instant due to concurrency limit
      expect(duration).toBeLessThan(200); // Much faster than 10 * 10ms sequential
      expect(duration).toBeGreaterThan(30); // But not instant due to batching
    });

    it('should handle empty arrays', async () => {
      const operation = vi.fn();
      const results = await executeInParallel([], operation);
      
      expect(results).toEqual([]);
      expect(operation).not.toHaveBeenCalled();
    });

    it('should execute all items concurrently when concurrency limit is high', async () => {
      const items = [1, 2, 3, 4, 5];
      const operation = vi.fn().mockImplementation(async (item) => {
        await sleep(20);
        return item;
      });

      const start = Date.now();
      const results = await executeInParallel(items, operation, { maxConcurrency: 10 });
      const duration = Date.now() - start;

      expect(results).toEqual([1, 2, 3, 4, 5]);
      expect(duration).toBeLessThan(50); // Should be close to single operation time
    });

    it('should handle operation failures', async () => {
      const items = [1, 2, 3];
      const operation = vi.fn().mockImplementation(async (item) => {
        if (item === 2) {
          throw new Error(`Failed on ${item}`);
        }
        return item;
      });

      await expect(executeInParallel(items, operation)).rejects.toThrow('Failed on 2');
    });

    it('should preserve result order', async () => {
      const items = [3, 1, 4, 1, 5];
      const operation = vi.fn().mockImplementation(async (item) => {
        // Add random delay to test ordering
        await sleep(Math.random() * 20);
        return item * 10;
      });

      const results = await executeInParallel(items, operation, { maxConcurrency: 2 });
      
      expect(results).toEqual([30, 10, 40, 10, 50]);
    });
  });

  describe('executeInBatches', () => {
    it('should execute operations in controlled batches', async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const operation = vi.fn().mockImplementation(async (batch) => {
        await sleep(10);
        return batch.map(item => item * 2);
      });

      const results = await executeInBatches(items, operation, { batchSize: 3 });

      expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
      expect(operation).toHaveBeenCalledTimes(4); // 3 + 3 + 3 + 1 = 4 batches
      
      // Check batch sizes
      expect(operation).toHaveBeenNthCalledWith(1, [0, 1, 2]);
      expect(operation).toHaveBeenNthCalledWith(2, [3, 4, 5]);
      expect(operation).toHaveBeenNthCalledWith(3, [6, 7, 8]);
      expect(operation).toHaveBeenNthCalledWith(4, [9]);
    });

    it('should add delays between batches', async () => {
      const items = [1, 2, 3, 4];
      const operation = vi.fn().mockImplementation(async (batch) => batch);

      const start = Date.now();
      await executeInBatches(items, operation, { 
        batchSize: 2, 
        batchDelayMs: 50 
      });
      const duration = Date.now() - start;

      expect(operation).toHaveBeenCalledTimes(2);
      expect(duration).toBeGreaterThanOrEqual(45); // Should include delay
    });

    it('should handle empty arrays', async () => {
      const operation = vi.fn();
      const results = await executeInBatches([], operation);
      
      expect(results).toEqual([]);
      expect(operation).not.toHaveBeenCalled();
    });

    it('should handle single batch', async () => {
      const items = [1, 2, 3];
      const operation = vi.fn().mockImplementation(async (batch) => batch);

      const results = await executeInBatches(items, operation, { batchSize: 5 });

      expect(results).toEqual([1, 2, 3]);
      expect(operation).toHaveBeenCalledOnce();
      expect(operation).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  describe('PromisePool', () => {
    it('should manage concurrent promise execution', async () => {
      const pool = new PromisePool(2); // Max 2 concurrent
      const executionOrder: number[] = [];

      const promises = [1, 2, 3, 4, 5].map(num => 
        pool.add(async () => {
          await sleep(20);
          executionOrder.push(num);
          return num;
        })
      );

      const results = await Promise.all(promises);
      await pool.drain();

      expect(results).toEqual([1, 2, 3, 4, 5]);
      expect(executionOrder).toHaveLength(5);
      // Order may vary due to concurrency, but all should be present
      expect(new Set(executionOrder)).toEqual(new Set([1, 2, 3, 4, 5]));
    });

    it('should handle promise failures', async () => {
      const pool = new PromisePool(2);

      const promise1 = pool.add(async () => 'success');
      const promise2 = pool.add(async () => {
        throw new Error('failed');
      });
      const promise3 = pool.add(async () => 'also success');

      const results = await Promise.allSettled([promise1, promise2, promise3]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      await pool.drain();
    });

    it('should drain properly with empty pool', async () => {
      const pool = new PromisePool(5);
      
      // Should resolve immediately
      await expect(pool.drain()).resolves.not.toThrow();
    });

    it('should limit concurrency correctly', async () => {
      const pool = new PromisePool(2);
      let activeCount = 0;
      let maxActiveCount = 0;

      const promises = Array.from({ length: 5 }, (_, i) => 
        pool.add(async () => {
          activeCount++;
          maxActiveCount = Math.max(maxActiveCount, activeCount);
          await sleep(50);
          activeCount--;
          return i;
        })
      );

      await Promise.all(promises);
      await pool.drain();

      expect(maxActiveCount).toBeLessThanOrEqual(2);
    });
  });

  describe('BatchWriter', () => {
    it('should accumulate items and flush in batches', async () => {
      const batches: number[][] = [];
      const batchOperation = vi.fn().mockImplementation(async (items: number[]) => {
        batches.push([...items]);
      });

      const config = { batchSize: 3 } as any;
      const writer = new BatchWriter(config, batchOperation, 3);

      // Add items
      for (let i = 1; i <= 7; i++) {
        writer.add(i);
      }

      expect(writer.size()).toBe(7);
      expect(writer.isReady()).toBe(true);

      await writer.flush();

      expect(batches).toHaveLength(3); // 3 + 3 + 1 = 3 batches
      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[1]).toEqual([4, 5, 6]);
      expect(batches[2]).toEqual([7]);
      expect(writer.size()).toBe(0);
    });

    it('should handle empty flush', async () => {
      const batchOperation = vi.fn();
      const config = { batchSize: 5 } as any;
      const writer = new BatchWriter(config, batchOperation);

      await writer.flush();

      expect(batchOperation).not.toHaveBeenCalled();
      expect(writer.size()).toBe(0);
    });

    it('should respect batch size limits', async () => {
      const batchOperation = vi.fn();
      const config = { batchSize: 2 } as any;
      const writer = new BatchWriter(config, batchOperation, 5); // Should use config.batchSize

      writer.add(1);
      expect(writer.isReady()).toBe(false);
      
      writer.add(2);
      expect(writer.isReady()).toBe(true);
      
      writer.add(3);
      expect(writer.size()).toBe(3);
    });

    it('should handle batch operation failures', async () => {
      const batchOperation = vi.fn().mockRejectedValue(new Error('Batch failed'));
      const config = { batchSize: 2 } as any;
      const writer = new BatchWriter(config, batchOperation);

      writer.add(1);
      writer.add(2);

      await expect(writer.flush()).rejects.toThrow('Batch failed');
    });
  });

  describe('AdaptiveDelayCalculator', () => {
    it('should increase delay when throttled', () => {
      const calculator = new AdaptiveDelayCalculator(100);

      const delay1 = calculator.getNextDelay(true); // Throttled
      const delay2 = calculator.getNextDelay(true); // Throttled again

      expect(delay1).toBe(200); // 100 * 2
      expect(delay2).toBe(400); // 200 * 2
    });

    it('should decrease delay when successful', () => {
      const calculator = new AdaptiveDelayCalculator(100);

      // First increase delay
      const delay1 = calculator.getNextDelay(true); // Throttled
      expect(delay1).toBe(200);

      // Then decrease on success
      const delay2 = calculator.getNextDelay(false); // Success
      expect(delay2).toBe(180); // 200 * 0.9
    });

    it('should cap maximum delay', () => {
      const calculator = new AdaptiveDelayCalculator(100);

      // Keep increasing delay
      let delay = 100;
      for (let i = 0; i < 10; i++) {
        delay = calculator.getNextDelay(true);
      }

      expect(delay).toBeLessThanOrEqual(5000); // Should be capped
    });

    it('should not go below base delay', () => {
      const calculator = new AdaptiveDelayCalculator(100);

      // Try to decrease below base
      let delay = 100;
      for (let i = 0; i < 10; i++) {
        delay = calculator.getNextDelay(false);
      }

      expect(delay).toBeGreaterThanOrEqual(100); // Should not go below base
    });

    it('should provide accurate average delay', () => {
      const calculator = new AdaptiveDelayCalculator(100);

      // Add some delays
      calculator.getNextDelay(true);   // 200
      calculator.getNextDelay(false);  // 180
      calculator.getNextDelay(false);  // 162

      const average = calculator.getAverageDelay();
      expect(average).toBeCloseTo((200 + 180 + 162) / 3, 1);
    });

    it('should limit sample history', () => {
      const calculator = new AdaptiveDelayCalculator(100);

      // Add more than max samples (10)
      for (let i = 0; i < 15; i++) {
        calculator.getNextDelay(i % 2 === 0); // Alternate success/failure
      }

      // Should still provide reasonable average
      const average = calculator.getAverageDelay();
      expect(average).toBeGreaterThan(0);
      expect(average).toBeLessThan(5000);
    });

    it('should return base delay when no samples', () => {
      const calculator = new AdaptiveDelayCalculator(150);
      
      const average = calculator.getAverageDelay();
      expect(average).toBe(150);
    });

    it('should handle custom base delay', () => {
      const calculator = new AdaptiveDelayCalculator(50);

      const delay = calculator.getNextDelay(false);
      expect(delay).toBe(50); // Should start with custom base
    });
  });

  describe('performance configuration', () => {
    it('should use default configuration values', async () => {
      const items = [1, 2, 3];
      const operation = vi.fn().mockImplementation(async (item) => item);

      // Should not throw with default config
      const results = await executeInParallel(items, operation);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should handle configuration edge cases', async () => {
      const items = [1, 2, 3, 4, 5];
      const operation = vi.fn().mockImplementation(async (item) => item);

      // Test with concurrency limit of 1 (sequential)
      const results1 = await executeInParallel(items, operation, { maxConcurrency: 1 });
      expect(results1).toEqual([1, 2, 3, 4, 5]);

      // Test with very high concurrency
      const results2 = await executeInParallel(items, operation, { maxConcurrency: 1000 });
      expect(results2).toEqual([1, 2, 3, 4, 5]);
    });
  });
});