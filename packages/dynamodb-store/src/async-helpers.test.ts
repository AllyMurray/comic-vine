import { describe, it, expect, vi } from 'vitest';
import { sleep, measureExecutionTime } from './async-helpers.js';

describe('async helpers utilities', () => {
  describe('sleep', () => {
    it('should sleep for specified milliseconds', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
      expect(elapsed).toBeLessThan(100); // Should not be much longer
    });

    it('should add jitter when specified', async () => {
      const results: Array<number> = [];

      // Run multiple times to test jitter variance
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await sleep(10, 5); // 10ms base + up to 5ms jitter
        results.push(Date.now() - start);
      }

      // Should have some variance due to jitter
      const min = Math.min(...results);
      const max = Math.max(...results);
      expect(max - min).toBeGreaterThan(0);
    });

    it('should handle zero sleep time', async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10); // Should be very quick
    });
  });

  describe('measureExecutionTime', () => {
    it('should measure execution time', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await sleep(50);
        return 'result';
      });

      const { result, durationMs } = await measureExecutionTime(operation);

      expect(result).toBe('result');
      expect(durationMs).toBeGreaterThanOrEqual(45);
      expect(durationMs).toBeLessThan(100);
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should handle operations that throw errors', async () => {
      const error = new Error('Test error');
      const operation = vi.fn().mockRejectedValue(error);

      await expect(measureExecutionTime(operation)).rejects.toThrow(
        'Test error',
      );
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should handle synchronous operations', async () => {
      const operation = vi.fn().mockResolvedValue('sync result');

      const { result, durationMs } = await measureExecutionTime(operation);

      expect(result).toBe('sync result');
      expect(durationMs).toBeGreaterThanOrEqual(0);
      expect(durationMs).toBeLessThan(10);
    });

    it('should preserve operation return type', async () => {
      const operation = async (): Promise<{ data: string; count: number }> => {
        return { data: 'test', count: 42 };
      };

      const { result } = await measureExecutionTime(operation);

      expect(result.data).toBe('test');
      expect(result.count).toBe(42);
    });
  });
});
