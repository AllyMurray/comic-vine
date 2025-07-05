import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryDedupeStore } from './in-memory-dedupe-store.js';

describe('InMemoryDedupeStore', () => {
  let store: InMemoryDedupeStore;
  let unhandledRejections: Error[] = [];

  beforeEach(() => {
    store = new InMemoryDedupeStore();
    unhandledRejections = [];

    // Catch any unhandled rejections
    process.on('unhandledRejection', (error: Error) => {
      if (
        error.message.includes('DedupeStore cleared') ||
        error.message.includes('Test error')
      ) {
        unhandledRejections.push(error);
      }
    });
  });

  afterEach(async () => {
    if (store) {
      // Wait a bit to allow any pending promises to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
      store.destroy();
      // Wait a bit more for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });

  describe('basic operations', () => {
    it('should register new jobs', async () => {
      const jobId = await store.register('test-hash');
      expect(jobId).toBeTruthy();
      expect(typeof jobId).toBe('string');
    });

    it('should return undefined for non-existent jobs', async () => {
      const result = await store.waitFor('non-existent-hash');
      expect(result).toBeUndefined();
    });

    it('should complete jobs with values', async () => {
      const hash = 'test-hash';
      await store.register(hash);
      await store.complete(hash, 'test-value');

      const result = await store.waitFor(hash);
      expect(result).toBe('test-value');
    });

    it('should handle job completion with complex objects', async () => {
      const hash = 'test-hash';
      const value = { id: 1, name: 'test', nested: { data: 'value' } };

      await store.register(hash);
      await store.complete(hash, value);

      const result = await store.waitFor(hash);
      expect(result).toEqual(value);
    });

    it('should handle job failure', async () => {
      const hash = 'test-hash';
      const error = new Error('Test error');

      await store.register(hash);

      // Start waiting for the job before failing it
      const waitPromise = store.waitFor(hash).catch(() => undefined);

      await store.fail(hash, error);

      // Failed jobs should not be available
      const result = await waitPromise;
      expect(result).toBeUndefined();
    });

    it('should check if jobs are in progress', async () => {
      const hash = 'test-hash';

      let isInProgress = await store.isInProgress(hash);
      expect(isInProgress).toBe(false);

      await store.register(hash);
      isInProgress = await store.isInProgress(hash);
      expect(isInProgress).toBe(true);

      await store.complete(hash, 'value');
      isInProgress = await store.isInProgress(hash);
      expect(isInProgress).toBe(false);
    });
  });

  describe('deduplication behavior', () => {
    it('should deduplicate concurrent requests', async () => {
      const hash = 'test-hash';
      const value = 'test-value';

      // Register the job first
      await store.register(hash);

      // Start multiple waitFor operations that should all wait for the same job
      const promise1 = store.waitFor(hash);
      const promise2 = store.waitFor(hash);
      const promise3 = store.waitFor(hash);

      // Complete the job
      await store.complete(hash, value);

      // All promises should resolve to the same value
      const [result1, result2, result3] = await Promise.all([
        promise1,
        promise2,
        promise3,
      ]);
      expect(result1).toBe(value);
      expect(result2).toBe(value);
      expect(result3).toBe(value);
    });

    it('should handle multiple jobs with different hashes', async () => {
      const hash1 = 'hash1';
      const hash2 = 'hash2';
      const value1 = 'value1';
      const value2 = 'value2';

      await store.register(hash1);
      await store.register(hash2);

      await store.complete(hash1, value1);
      await store.complete(hash2, value2);

      const result1 = await store.waitFor(hash1);
      const result2 = await store.waitFor(hash2);

      expect(result1).toBe(value1);
      expect(result2).toBe(value2);
    });

    it('should clean up completed jobs', async () => {
      const hash = 'test-hash';

      await store.register(hash);
      await store.complete(hash, 'value');

      // Job should be marked as completed
      const isInProgress = await store.isInProgress(hash);
      expect(isInProgress).toBe(false);

      // But the result should still be available
      const result = await store.waitFor(hash);
      expect(result).toBe('value');
    });

    it('should clean up failed jobs', async () => {
      const hash = 'test-hash';
      const error = new Error('Test error');

      await store.register(hash);

      // Start waiting for the job before failing it
      const waitPromise = store.waitFor(hash).catch(() => undefined);

      await store.fail(hash, error);

      const isInProgress = await store.isInProgress(hash);
      expect(isInProgress).toBe(false);

      const result = await waitPromise;
      expect(result).toBeUndefined();
    });
  });

  describe('timeout handling', () => {
    it('should handle job timeouts', async () => {
      const timeoutStore = new InMemoryDedupeStore({
        jobTimeoutMs: 10,
        cleanupIntervalMs: 5,
      });
      const hash = 'test-hash';

      await timeoutStore.register(hash);

      // Start waiting for the job to catch the timeout rejection
      const waitPromise = timeoutStore.waitFor(hash).catch(() => undefined);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      const isInProgress = await timeoutStore.isInProgress(hash);
      expect(isInProgress).toBe(false);

      // Ensure the promise is handled
      await waitPromise;

      timeoutStore.destroy();
    });

    it('should not timeout jobs that complete in time', async () => {
      const timeoutStore = new InMemoryDedupeStore({ jobTimeoutMs: 100 });
      const hash = 'test-hash';

      await timeoutStore.register(hash);
      await timeoutStore.complete(hash, 'value');

      // Wait less than timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = await timeoutStore.waitFor(hash);
      expect(result).toBe('value');

      timeoutStore.destroy();
    });

    it('should handle timeout of 0 (disabled)', async () => {
      const timeoutStore = new InMemoryDedupeStore({ jobTimeoutMs: 0 });
      const hash = 'test-hash';

      await timeoutStore.register(hash);

      // Start waiting for the job to catch any potential rejections
      const waitPromise = timeoutStore.waitFor(hash).catch(() => undefined);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should still be in progress since timeout is disabled
      const isInProgress = await timeoutStore.isInProgress(hash);
      expect(isInProgress).toBe(true);

      timeoutStore.destroy();

      // Ensure the promise is handled
      await waitPromise;
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', async () => {
      await store.register('hash1');
      await store.register('hash2');

      // Start waiting for jobs to catch potential rejections during cleanup
      const waitPromise1 = store.waitFor('hash1').catch(() => undefined);
      const waitPromise2 = store.waitFor('hash2').catch(() => undefined);

      const stats = store.getStats();
      expect(stats.activeJobs).toBe(2);
      expect(stats.totalJobsProcessed).toBe(2);

      // Complete the jobs to avoid unhandled rejections
      await store.complete('hash1', 'value1');
      await store.complete('hash2', 'value2');

      // Ensure promises are handled
      await Promise.all([waitPromise1, waitPromise2]);
    });

    it('should update statistics after completion', async () => {
      await store.register('hash1');
      await store.complete('hash1', 'value');

      const stats = store.getStats();
      expect(stats.activeJobs).toBe(0);
      expect(stats.totalJobsProcessed).toBe(1);
    });

    it('should update statistics after failure', async () => {
      await store.register('hash1');

      // Start waiting for the job before failing it
      const waitPromise = store.waitFor('hash1').catch(() => undefined);

      await store.fail('hash1', new Error('Test error'));

      // Ensure the promise is handled
      await waitPromise;

      const stats = store.getStats();
      expect(stats.activeJobs).toBe(0);
      expect(stats.totalJobsProcessed).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle completing non-existent jobs', async () => {
      await expect(
        store.complete('non-existent', 'value'),
      ).resolves.not.toThrow();
    });

    it('should handle failing non-existent jobs', async () => {
      await expect(
        store.fail('non-existent', new Error('Test')),
      ).resolves.not.toThrow();
    });

    it('should handle double completion', async () => {
      const hash = 'test-hash';
      await store.register(hash);
      await store.complete(hash, 'value1');
      await store.complete(hash, 'value2');

      const result = await store.waitFor(hash);
      expect(result).toBe('value1'); // First completion should win
    });

    it('should handle completion after failure', async () => {
      const hash = 'test-hash';
      await store.register(hash);

      // Start waiting for the job before failing it
      const waitPromise = store.waitFor(hash).catch(() => undefined);

      await store.fail(hash, new Error('Test error'));
      await store.complete(hash, 'value');

      const result = await waitPromise;
      expect(result).toBeUndefined(); // Should still be failed
    });

    it('should handle many concurrent jobs', async () => {
      const promises: Promise<string>[] = [];

      // Create 100 jobs
      for (let i = 0; i < 100; i++) {
        promises.push(store.register(`hash${i}`));
      }

      await Promise.all(promises);

      // Complete all jobs
      const completePromises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        completePromises.push(store.complete(`hash${i}`, `value${i}`));
      }

      await Promise.all(completePromises);

      // Verify all jobs completed
      const stats = store.getStats();
      expect(stats.activeJobs).toBe(0);
      expect(stats.totalJobsProcessed).toBe(100);
    });

    it('should handle special characters in hash keys', async () => {
      const specialHash = 'hash-with-特殊字符-and-émojis-🚀';
      await store.register(specialHash);
      await store.complete(specialHash, 'special value');

      const result = await store.waitFor(specialHash);
      expect(result).toBe('special value');
    });

    it('should handle null and undefined values', async () => {
      const hash1 = 'null-hash';
      const hash2 = 'undefined-hash';

      await store.register(hash1);
      await store.register(hash2);

      await store.complete(hash1, null);
      await store.complete(hash2, undefined);

      const result1 = await store.waitFor(hash1);
      const result2 = await store.waitFor(hash2);

      expect(result1).toBeNull();
      expect(result2).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should clear all jobs when destroyed', async () => {
      await store.register('hash1');
      await store.register('hash2');

      // Start waiting for jobs to catch the destruction rejections
      const waitPromise1 = store.waitFor('hash1').catch(() => undefined);
      const waitPromise2 = store.waitFor('hash2').catch(() => undefined);

      store.destroy();

      // Ensure the promises are handled
      await Promise.all([waitPromise1, waitPromise2]);

      const stats = store.getStats();
      expect(stats.activeJobs).toBe(0);
    });

    it('should be safe to call destroy multiple times', () => {
      expect(() => {
        store.destroy();
        store.destroy();
      }).not.toThrow();
    });

    it('should handle operations after destroy', async () => {
      store.destroy();

      const jobId = await store.register('hash1');
      expect(jobId).toBeTruthy();

      const result = await store.waitFor('hash1');
      expect(result).toBeUndefined();
    });
  });
});
