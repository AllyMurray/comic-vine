import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker } from './circuit-breaker.js';
import { ThrottlingError, DynamoDBStoreError } from './types.js';
import {
  calculateTTL,
  isExpired,
  serializeValue,
  deserializeValue,
  sleep,
  calculateBackoffDelay,
  isThrottlingError,
  isConditionalCheckFailedError,
  isSevereError,
  calculateOptimalBatchSize,
  measureExecutionTime,
  chunkArray,
  retryWithBackoff,
  MAX_ITEM_SIZE_BYTES,
  DEFAULT_DEDUPE_TTL_SECONDS,
} from './utils.js';
import * as utils from './utils.js';

describe('utils', () => {
  describe('TTL utilities', () => {
    describe('calculateTTL', () => {
      it('should calculate future TTL timestamp', () => {
        const now = Math.floor(Date.now() / 1000);
        const ttl = calculateTTL(60); // 1 minute

        expect(ttl).toBeGreaterThan(now);
        expect(ttl).toBeLessThanOrEqual(now + 60);
      });

      it('should handle zero TTL', () => {
        const now = Math.floor(Date.now() / 1000);
        const ttl = calculateTTL(0);

        expect(ttl).toBeLessThanOrEqual(now);
      });

      it('should handle negative TTL', () => {
        const now = Math.floor(Date.now() / 1000);
        const ttl = calculateTTL(-1);

        expect(ttl).toBeLessThanOrEqual(now);
      });
    });

    describe('isExpired', () => {
      it('should return false for future TTL', () => {
        const futureTtl = Math.floor(Date.now() / 1000) + 60;
        expect(isExpired(futureTtl)).toBe(false);
      });

      it('should return true for past TTL', () => {
        const pastTtl = Math.floor(Date.now() / 1000) - 60;
        expect(isExpired(pastTtl)).toBe(true);
      });

      it('should return true for current TTL', () => {
        const currentTtl = Math.floor(Date.now() / 1000);
        expect(isExpired(currentTtl)).toBe(true);
      });
    });
  });

  describe('serialization utilities', () => {
    describe('serializeValue', () => {
      it('should serialize string values', () => {
        const result = serializeValue('test string');
        expect(result).toBe('"test string"');
      });

      it('should serialize number values', () => {
        const result = serializeValue(42);
        expect(result).toBe('42');
      });

      it('should serialize boolean values', () => {
        expect(serializeValue(true)).toBe('true');
        expect(serializeValue(false)).toBe('false');
      });

      it('should serialize object values', () => {
        const obj = { id: 1, name: 'test' };
        const result = serializeValue(obj);
        expect(result).toBe('{"id":1,"name":"test"}');
      });

      it('should serialize array values', () => {
        const arr = [1, 2, 'three'];
        const result = serializeValue(arr);
        expect(result).toBe('[1,2,"three"]');
      });

      it('should serialize null values', () => {
        const result = serializeValue(null);
        expect(result).toBe('null');
      });

      it('should serialize undefined values', () => {
        const result = serializeValue(undefined);
        expect(result).toBe('__UNDEFINED__');
      });

      it('should throw error for circular references', () => {
        const obj: { name: string; self?: unknown } = { name: 'test' };
        obj.self = obj;

        expect(() => serializeValue(obj)).toThrow(DynamoDBStoreError);
      });

      it('should throw error for values exceeding size limit', () => {
        const largeValue = 'x'.repeat(MAX_ITEM_SIZE_BYTES + 1);

        expect(() => serializeValue(largeValue)).toThrow('Item size');
      });
    });

    describe('deserializeValue', () => {
      it('should deserialize string values', () => {
        const result = deserializeValue<string>('"test string"');
        expect(result).toBe('test string');
      });

      it('should deserialize number values', () => {
        const result = deserializeValue<number>('42');
        expect(result).toBe(42);
      });

      it('should deserialize boolean values', () => {
        expect(deserializeValue<boolean>('true')).toBe(true);
        expect(deserializeValue<boolean>('false')).toBe(false);
      });

      it('should deserialize object values', () => {
        const result = deserializeValue<{ id: number; name: string }>(
          '{"id":1,"name":"test"}',
        );
        expect(result).toEqual({ id: 1, name: 'test' });
      });

      it('should deserialize array values', () => {
        const result =
          deserializeValue<Array<string | number>>('[1,2,"three"]');
        expect(result).toEqual([1, 2, 'three']);
      });

      it('should deserialize null values', () => {
        const result = deserializeValue('null');
        expect(result).toBeNull();
      });

      it('should deserialize undefined values', () => {
        const result = deserializeValue('__UNDEFINED__');
        expect(result).toBeUndefined();
      });

      it('should throw error for invalid JSON', () => {
        expect(() => deserializeValue('invalid json')).toThrow(
          DynamoDBStoreError,
        );
      });
    });
  });

  describe('timing utilities', () => {
    describe('sleep', () => {
      it('should sleep for specified duration', async () => {
        const start = Date.now();
        await sleep(50);
        const end = Date.now();

        expect(end - start).toBeGreaterThanOrEqual(45); // Allow some variance
      });

      it('should sleep with jitter', async () => {
        const durations: Array<number> = [];

        // Run multiple times to test jitter variation
        for (let i = 0; i < 5; i++) {
          const start = Date.now();
          await sleep(50, 20); // 50ms ± 20ms jitter
          const end = Date.now();
          durations.push(end - start);
        }

        // Should have some variation due to jitter
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        expect(maxDuration - minDuration).toBeGreaterThan(0);
      });
    });

    describe('calculateBackoffDelay', () => {
      it('should calculate exponential backoff', () => {
        const delay1 = calculateBackoffDelay(0, 100); // First attempt
        const delay2 = calculateBackoffDelay(1, 100); // Second attempt
        const delay3 = calculateBackoffDelay(2, 100); // Third attempt

        expect(delay1).toBeGreaterThanOrEqual(100);
        expect(delay2).toBeGreaterThanOrEqual(200);
        expect(delay3).toBeGreaterThanOrEqual(400);

        // Should include jitter, so not exact multiples
        expect(delay2).not.toBe(200);
        expect(delay3).not.toBe(400);
      });

      it('should respect max delay', () => {
        const delay = calculateBackoffDelay(10, 100, 1000); // Large attempt with max
        expect(delay).toBeLessThanOrEqual(1100); // Max + some jitter tolerance
      });

      it('should include random jitter', () => {
        const delays = Array(10)
          .fill(null)
          .map(() => calculateBackoffDelay(2, 100));

        // All delays should be different due to jitter
        const uniqueDelays = new Set(delays);
        expect(uniqueDelays.size).toBeGreaterThan(1);
      });
    });
  });

  describe('error detection utilities', () => {
    describe('isThrottlingError', () => {
      it('should detect ThrottlingException by name', () => {
        const error = new Error('Rate limited');
        (error as Error & { name: string }).name = 'ThrottlingException';

        expect(isThrottlingError(error)).toBe(true);
      });

      it('should detect ProvisionedThroughputExceededException by name', () => {
        const error = new Error('Throughput exceeded');
        (error as Error & { name: string }).name =
          'ProvisionedThroughputExceededException';

        expect(isThrottlingError(error)).toBe(true);
      });

      it('should detect throttling by code', () => {
        const error = new Error('Throttled');
        (error as Error & { code: string }).code = 'ThrottlingException';

        expect(isThrottlingError(error)).toBe(true);
      });

      it('should return false for non-throttling errors', () => {
        const error = new Error('Other error');
        expect(isThrottlingError(error)).toBe(false);

        expect(isThrottlingError(null)).toBe(false);
        expect(isThrottlingError(undefined)).toBe(false);
        expect(isThrottlingError('string')).toBe(false);
      });
    });

    describe('isConditionalCheckFailedError', () => {
      it('should detect ConditionalCheckFailedException by name', () => {
        const error = new Error('Condition failed');
        (error as Error & { name: string }).name =
          'ConditionalCheckFailedException';

        expect(isConditionalCheckFailedError(error)).toBe(true);
      });

      it('should detect conditional check failure by code', () => {
        const error = new Error('Condition failed');
        (error as Error & { code: string }).code =
          'ConditionalCheckFailedException';

        expect(isConditionalCheckFailedError(error)).toBe(true);
      });

      it('should return false for non-conditional errors', () => {
        const error = new Error('Other error');
        expect(isConditionalCheckFailedError(error)).toBe(false);
      });
    });

    describe('isSevereError', () => {
      it('should detect service unavailable errors', () => {
        const error1 = new Error('Service down');
        (error1 as Error & { name: string }).name = 'ServiceUnavailable';
        expect(isSevereError(error1)).toBe(true);

        const error2 = new Error('Service down');
        (error2 as Error & { statusCode: number }).statusCode = 503;
        expect(isSevereError(error2)).toBe(true);
      });

      it('should detect internal server errors', () => {
        const error1 = new Error('Internal error');
        (error1 as Error & { name: string }).name = 'InternalServerError';
        expect(isSevereError(error1)).toBe(true);

        const error2 = new Error('Internal error');
        (error2 as Error & { statusCode: number }).statusCode = 500;
        expect(isSevereError(error2)).toBe(true);
      });

      it('should detect connection timeout errors', () => {
        const error1 = new Error('Timeout');
        (error1 as Error & { name: string }).name = 'TimeoutError';
        expect(isSevereError(error1)).toBe(true);

        const error2 = new Error('Connection reset');
        (error2 as Error & { code: string }).code = 'ECONNRESET';
        expect(isSevereError(error2)).toBe(true);
      });

      it('should return false for non-severe errors', () => {
        const error = new Error('Validation error');
        expect(isSevereError(error)).toBe(false);

        expect(isSevereError(null)).toBe(false);
        expect(isSevereError('string')).toBe(false);
      });
    });
  });

  describe('performance utilities', () => {
    describe('calculateOptimalBatchSize', () => {
      it('should calculate optimal batch size based on item size', () => {
        const itemSize = 1024; // 1KB per item
        const batchSize = calculateOptimalBatchSize(itemSize);

        // Should fit within 16MB limit
        expect(batchSize * itemSize).toBeLessThanOrEqual(16 * 1024 * 1024);
        expect(batchSize).toBeLessThanOrEqual(25); // DynamoDB max
      });

      it('should respect maximum batch size', () => {
        const smallItemSize = 100; // Very small items
        const batchSize = calculateOptimalBatchSize(smallItemSize, 10);

        expect(batchSize).toBeLessThanOrEqual(10);
      });

      it('should handle large items', () => {
        const largeItemSize = 1024 * 1024; // 1MB per item
        const batchSize = calculateOptimalBatchSize(largeItemSize);

        expect(batchSize).toBeGreaterThan(0);
        expect(batchSize).toBeLessThanOrEqual(16); // Should fit ~16 items max
      });
    });

    describe('measureExecutionTime', () => {
      it('should measure operation execution time', async () => {
        const operation = async () => {
          await sleep(50);
          return 'result';
        };

        const { result, durationMs } = await measureExecutionTime(operation);

        expect(result).toBe('result');
        expect(durationMs).toBeGreaterThanOrEqual(45); // Allow some variance
        expect(durationMs).toBeLessThan(100); // Should be reasonably close
      });

      it('should measure fast operations', async () => {
        const operation = async () => {
          return 'fast';
        };

        const { result, durationMs } = await measureExecutionTime(operation);

        expect(result).toBe('fast');
        expect(durationMs).toBeGreaterThanOrEqual(0);
        expect(durationMs).toBeLessThan(10); // Should be very fast
      });

      it('should handle operation errors', async () => {
        const operation = async () => {
          throw new Error('Test error');
        };

        await expect(measureExecutionTime(operation)).rejects.toThrow(
          'Test error',
        );
      });
    });

    describe('chunkArray', () => {
      it('should chunk array into specified sizes', () => {
        const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const chunks = chunkArray(array, 3);

        expect(chunks).toHaveLength(4);
        expect(chunks[0]).toEqual([1, 2, 3]);
        expect(chunks[1]).toEqual([4, 5, 6]);
        expect(chunks[2]).toEqual([7, 8, 9]);
        expect(chunks[3]).toEqual([10]);
      });

      it('should handle empty arrays', () => {
        const chunks = chunkArray([], 5);
        expect(chunks).toHaveLength(0);
      });

      it('should handle arrays smaller than chunk size', () => {
        const array = [1, 2];
        const chunks = chunkArray(array, 5);

        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toEqual([1, 2]);
      });

      it('should handle chunk size of 1', () => {
        const array = [1, 2, 3];
        const chunks = chunkArray(array, 1);

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toEqual([1]);
        expect(chunks[1]).toEqual([2]);
        expect(chunks[2]).toEqual([3]);
      });
    });
  });

  describe('retry utilities', () => {
    describe('retryWithBackoff', () => {
      const mockConfig = {
        maxRetries: 3,
        retryDelayMs: 10,
        circuitBreaker: { enabled: false },
      };

      it('should succeed on first attempt', async () => {
        const operation = vi.fn().mockResolvedValue('success');

        const result = await retryWithBackoff(operation, mockConfig, 'test-op');

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledOnce();
      });

      it('should retry on throttling errors', async () => {
        const throttleError = new Error('Throttled');
        (throttleError as Error & { name: string }).name =
          'ThrottlingException';

        const operation = vi
          .fn()
          .mockRejectedValueOnce(throttleError)
          .mockRejectedValueOnce(throttleError)
          .mockResolvedValue('success');

        const result = await retryWithBackoff(
          operation,
          mockConfig,
          'throttle-op',
        );

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(3);
      });

      it('should not retry on non-throttling errors', async () => {
        const validationError = new Error('Invalid input');
        const operation = vi.fn().mockRejectedValue(validationError);

        await expect(
          retryWithBackoff(operation, mockConfig, 'validation-op'),
        ).rejects.toThrow('Invalid input');

        expect(operation).toHaveBeenCalledOnce();
      });

      it('should throw ThrottlingError after max retries', async () => {
        const throttleError = new Error('Throttled');
        (throttleError as Error & { name: string }).name =
          'ThrottlingException';

        const operation = vi.fn().mockRejectedValue(throttleError);

        await expect(
          retryWithBackoff(operation, mockConfig, 'max-retry-op'),
        ).rejects.toThrow(ThrottlingError);

        expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
      });

      it('should throw DynamoDBStoreError for other persistent failures', async () => {
        const persistentError = new Error('Network error');
        (persistentError as Error & { name: string }).name =
          'ThrottlingException'; // Make it retryable

        const operation = vi.fn().mockRejectedValue(persistentError);

        // Override to make it not a throttling error for final throw
        vi.spyOn(utils, 'isThrottlingError').mockReturnValue(false);

        await expect(
          retryWithBackoff(operation, mockConfig, 'persistent-op'),
        ).rejects.toThrow(DynamoDBStoreError);

        vi.restoreAllMocks();
      });

      it('should work with circuit breaker', async () => {
        const circuitBreaker = new CircuitBreaker({
          circuitBreaker: {
            enabled: true,
            failureThreshold: 2,
            recoveryTimeoutMs: 1000,
            timeoutMs: 100,
          },
        });

        const operation = vi.fn().mockResolvedValue('cb-success');

        const result = await retryWithBackoff(
          operation,
          mockConfig,
          'cb-op',
          circuitBreaker,
        );

        expect(result).toBe('cb-success');
        expect(operation).toHaveBeenCalledOnce();
      });
    });
  });

  describe('constants', () => {
    it('should export correct constants', () => {
      expect(MAX_ITEM_SIZE_BYTES).toBe(400 * 1024);
      expect(DEFAULT_DEDUPE_TTL_SECONDS).toBe(5 * 60);
    });
  });
});
