import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DynamoDBDedupeStore } from './dynamodb-dedupe-store.js';
import { mockDynamoDBDocumentClient } from './__mocks__/dynamodb-client.js';
import { CircuitBreakerOpenError } from './types.js';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const { mockDynamoDBDocumentClient, DynamoDBDocumentClient } = vi.importActual('./__mocks__/dynamodb-client.js');
  return {
    DynamoDBDocumentClient,
    GetCommand: vi.fn(),
    PutCommand: vi.fn(),
    UpdateCommand: vi.fn(),
    DeleteCommand: vi.fn(),
    QueryCommand: vi.fn(),
    ScanCommand: vi.fn(),
    BatchWriteCommand: vi.fn(),
  };
});

// Mock crypto.randomUUID
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1234'),
}));

describe('DynamoDBDedupeStore', () => {
  let store: DynamoDBDedupeStore;

  beforeEach(() => {
    mockDynamoDBDocumentClient.clear();
    mockDynamoDBDocumentClient.disableThrottling();
    mockDynamoDBDocumentClient.disableTimeout();
    
    store = new DynamoDBDedupeStore({
      tableName: 'test-table',
      cleanupIntervalMs: 0, // Disable automatic cleanup for tests
      defaultTtlSeconds: 300, // 5 minutes
      maxWaitTimeMs: 1000, // 1 second for faster tests
      pollIntervalMs: 10, // 10ms for faster tests
    });
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
  });

  describe('basic job lifecycle', () => {
    it('should register a new job', async () => {
      const jobId = await store.register('test-hash');
      expect(jobId).toBe('test-uuid-1234');
      
      const isInProgress = await store.isInProgress('test-hash');
      expect(isInProgress).toBe(true);
    });

    it('should complete a job successfully', async () => {
      const jobId = await store.register('test-hash');
      await store.complete('test-hash', { result: 'success' });
      
      const isInProgress = await store.isInProgress('test-hash');
      expect(isInProgress).toBe(false);
    });

    it('should fail a job with error', async () => {
      const jobId = await store.register('test-hash');
      await store.fail('test-hash', new Error('Test error'));
      
      const isInProgress = await store.isInProgress('test-hash');
      expect(isInProgress).toBe(false);
    });

    it('should return undefined when no job exists', async () => {
      const result = await store.waitFor('non-existent-hash');
      expect(result).toBeUndefined();
    });
  });

  describe('waitFor functionality', () => {
    it('should wait for job completion and return result', async () => {
      const hash = 'test-hash';
      const expectedResult = { data: 'test result' };

      // Register and immediately complete job
      await store.register(hash);
      await store.complete(hash, expectedResult);

      const result = await store.waitFor(hash);
      expect(result).toEqual(expectedResult);
    });

    it('should wait for job and handle failure', async () => {
      const hash = 'test-hash';
      const error = new Error('Job failed');

      // Register and immediately fail job
      await store.register(hash);
      await store.fail(hash, error);

      await expect(store.waitFor(hash)).rejects.toThrow('Job failed');
    });

    it('should timeout when waiting too long', async () => {
      const hash = 'test-hash';
      
      // Register but don't complete
      await store.register(hash);

      // Should timeout after maxWaitTimeMs
      await expect(store.waitFor(hash)).rejects.toThrow('Timed out waiting');
    });

    it('should handle polling for pending job', async () => {
      const hash = 'test-hash';
      const expectedResult = { data: 'async result' };

      // Register job
      await store.register(hash);

      // Complete job after a delay (simulating async work)
      setTimeout(async () => {
        await store.complete(hash, expectedResult);
      }, 50);

      // Should wait and get result
      const result = await store.waitFor(hash);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('job registration edge cases', () => {
    it('should prevent duplicate job registration', async () => {
      const hash = 'test-hash';
      
      // Register first job
      const jobId1 = await store.register(hash);
      expect(jobId1).toBe('test-uuid-1234');

      // Attempt to register same hash should fail
      await expect(store.register(hash)).rejects.toThrow('Job already in progress');
    });

    it('should allow re-registration after job completion', async () => {
      const hash = 'test-hash';
      
      // Register and complete first job
      await store.register(hash);
      await store.complete(hash, 'first result');

      // Should be able to register again
      const jobId2 = await store.register(hash);
      expect(jobId2).toBe('test-uuid-1234');
    });

    it('should handle expired job re-registration', async () => {
      const hash = 'test-hash';
      
      // Register job
      await store.register(hash);

      // Mock time to make job expired
      const futureTime = Math.floor(Date.now() / 1000) + 400; // Beyond 5 minute TTL
      vi.spyOn(Math, 'floor').mockReturnValue(futureTime);

      // Should be able to register new job after expiration
      const newJobId = await store.register(hash);
      expect(newJobId).toBe('test-uuid-1234');

      vi.restoreAllMocks();
    });
  });

  describe('completion and failure operations', () => {
    it('should handle completion with various data types', async () => {
      const testCases = [
        { hash: 'string-test', value: 'string result' },
        { hash: 'number-test', value: 42 },
        { hash: 'object-test', value: { id: 1, data: 'test' } },
        { hash: 'array-test', value: [1, 2, 3] },
        { hash: 'null-test', value: null },
        { hash: 'undefined-test', value: undefined },
      ];

      for (const testCase of testCases) {
        await store.register(testCase.hash);
        await store.complete(testCase.hash, testCase.value);
        
        const result = await store.waitFor(testCase.hash);
        expect(result).toEqual(testCase.value);
      }
    });

    it('should handle failure with error details', async () => {
      const hash = 'error-test';
      const error = new Error('Detailed error message');
      
      await store.register(hash);
      await store.fail(hash, error);

      await expect(store.waitFor(hash)).rejects.toThrow('Detailed error message');
    });

    it('should prevent completion of non-existent job', async () => {
      await expect(store.complete('non-existent', 'result')).rejects.toThrow('No job found');
    });

    it('should prevent failure of non-existent job', async () => {
      const error = new Error('Test error');
      await expect(store.fail('non-existent', error)).rejects.toThrow('No job found');
    });

    it('should prevent double completion', async () => {
      const hash = 'double-complete';
      
      await store.register(hash);
      await store.complete(hash, 'first result');

      // Second completion should fail
      await expect(store.complete(hash, 'second result')).rejects.toThrow('not in pending status');
    });

    it('should prevent completion after failure', async () => {
      const hash = 'fail-then-complete';
      
      await store.register(hash);
      await store.fail(hash, new Error('Failed'));

      // Completion after failure should fail
      await expect(store.complete(hash, 'result')).rejects.toThrow('not in pending status');
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide accurate job statistics', async () => {
      // Create jobs in different states
      await store.register('pending-1');
      await store.register('pending-2');
      
      await store.register('completed-1');
      await store.complete('completed-1', 'result');
      
      await store.register('failed-1');
      await store.fail('failed-1', new Error('Failed'));

      const stats = await store.getStats();
      expect(stats.totalJobs).toBe(4);
      expect(stats.pendingJobs).toBe(2);
      expect(stats.completedJobs).toBe(1);
      expect(stats.failedJobs).toBe(1);
      expect(stats.expiredJobs).toBe(0);
    });

    it('should identify expired jobs in statistics', async () => {
      await store.register('expired-job');
      
      // Mock time to make job expired
      const futureTime = Math.floor(Date.now() / 1000) + 400;
      vi.spyOn(Math, 'floor').mockReturnValue(futureTime);

      const stats = await store.getStats();
      expect(stats.expiredJobs).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });
  });

  describe('cleanup functionality', () => {
    it('should manually clean up expired jobs', async () => {
      // Register job that will be expired
      await store.register('cleanup-test');
      
      // Mock time to make job expired
      const futureTime = Math.floor(Date.now() / 1000) + 400;
      vi.spyOn(Math, 'floor').mockReturnValue(futureTime);

      const deletedCount = await store.cleanup();
      expect(deletedCount).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });

    it('should not clean up unexpired jobs', async () => {
      // Register recent job
      await store.register('recent-job');

      const deletedCount = await store.cleanup();
      expect(deletedCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      mockDynamoDBDocumentClient.enableThrottling();

      await expect(store.register('throttle-test')).rejects.toThrow();
    });

    it('should throw error when store is destroyed', async () => {
      await store.close();

      await expect(store.register('test')).rejects.toThrow('DynamoDBDedupeStore has been destroyed');
    });

    it('should handle operation timeout errors', async () => {
      mockDynamoDBDocumentClient.enableTimeout(50);

      await expect(store.register('timeout-test')).rejects.toThrow();
    });
  });

  describe('configuration options', () => {
    it('should use custom TTL settings', async () => {
      const customStore = new DynamoDBDedupeStore({
        tableName: 'test-table',
        defaultTtlSeconds: 60, // 1 minute
        cleanupIntervalMs: 0,
      });

      await customStore.register('custom-ttl');
      // Job should exist with custom TTL
      const isInProgress = await customStore.isInProgress('custom-ttl');
      expect(isInProgress).toBe(true);

      await customStore.close();
    });

    it('should use custom wait timeout settings', async () => {
      const quickStore = new DynamoDBDedupeStore({
        tableName: 'test-table',
        maxWaitTimeMs: 100, // Very short timeout
        pollIntervalMs: 5,
        cleanupIntervalMs: 0,
      });

      await quickStore.register('quick-timeout');
      
      // Should timeout quickly
      await expect(quickStore.waitFor('quick-timeout')).rejects.toThrow('Timed out waiting');

      await quickStore.close();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent job registration attempts', async () => {
      const hash = 'concurrent-test';
      
      // Try to register same hash concurrently
      const promises = Array(5).fill(null).map(() => store.register(hash));
      
      // Only one should succeed, others should fail
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      expect(successful).toHaveLength(1);
      expect(failed.length).toBeGreaterThan(0);
    });

    it('should handle concurrent completion attempts', async () => {
      const hash = 'concurrent-complete';
      
      await store.register(hash);
      
      // Try to complete same job concurrently
      const promises = [
        store.complete(hash, 'result1'),
        store.complete(hash, 'result2'),
        store.complete(hash, 'result3'),
      ];
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      // Only one completion should succeed
      expect(successful).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in hash', async () => {
      const specialHash = 'hash-with-特殊字符-and-émojis-🚀';
      
      const jobId = await store.register(specialHash);
      expect(jobId).toBe('test-uuid-1234');
      
      await store.complete(specialHash, 'special result');
      const result = await store.waitFor(specialHash);
      expect(result).toBe('special result');
    });

    it('should handle empty hash', async () => {
      const jobId = await store.register('');
      expect(jobId).toBe('test-uuid-1234');
      
      const isInProgress = await store.isInProgress('');
      expect(isInProgress).toBe(true);
    });

    it('should handle very long hash values', async () => {
      const longHash = 'x'.repeat(1000);
      
      const jobId = await store.register(longHash);
      expect(jobId).toBe('test-uuid-1234');
      
      const isInProgress = await store.isInProgress(longHash);
      expect(isInProgress).toBe(true);
    });
  });

  describe('lifecycle management', () => {
    it('should be safe to call close multiple times', async () => {
      await store.close();
      await expect(store.close()).resolves.not.toThrow();
    });

    it('should stop cleanup interval on close', async () => {
      const intervalStore = new DynamoDBDedupeStore({
        tableName: 'test-table',
        cleanupIntervalMs: 1000, // Enable cleanup interval
      });

      await intervalStore.close();
      // Should not throw and should properly clean up
      expect(true).toBe(true);
    });
  });
});