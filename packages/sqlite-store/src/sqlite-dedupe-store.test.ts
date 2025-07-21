import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteDedupeStore } from './sqlite-dedupe-store.js';

describe('SQLiteDedupeStore', () => {
  let store: SQLiteDedupeStore;
  const testDbPath = path.join(__dirname, 'test-dedupe.db');

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    store = new SQLiteDedupeStore({ database: testDbPath });
  });

  afterEach(() => {
    if (store) {
      store.destroy();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
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
      await store.fail(hash, error);

      // Failed jobs should not be available
      const result = await store.waitFor(hash);
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
  });

  describe('persistence', () => {
    it('should persist jobs across store instances', async () => {
      const hash = 'persistent-hash';
      await store.register(hash);
      await store.complete(hash, 'persistent-value');

      store.destroy();

      // Create new store instance with same database
      const newStore = new SQLiteDedupeStore({ database: testDbPath });
      const result = await newStore.waitFor(hash);
      expect(result).toBe('persistent-value');

      newStore.destroy();
    });

    it('should handle cross-process deduplication', async () => {
      const hash = 'cross-process-hash';

      // Store 1 registers the job
      await store.register(hash);

      // Store 2 can see the job is in progress
      const store2 = new SQLiteDedupeStore({ database: testDbPath });
      const isInProgress = await store2.isInProgress(hash);
      expect(isInProgress).toBe(true);

      // Store 1 completes the job
      await store.complete(hash, 'cross-process-value');

      // Store 2 can get the result
      const result = await store2.waitFor(hash);
      expect(result).toBe('cross-process-value');

      store2.destroy();
    });
  });

  describe('timeout handling', () => {
    it('should handle job timeouts', async () => {
      const timeoutStore = new SQLiteDedupeStore({
        database: testDbPath,
        timeoutMs: 10,
      });
      const hash = 'test-hash';

      await timeoutStore.register(hash);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      const isInProgress = await timeoutStore.isInProgress(hash);
      expect(isInProgress).toBe(false);

      timeoutStore.destroy();
    });

    it('should not timeout jobs that complete in time', async () => {
      const timeoutStore = new SQLiteDedupeStore({
        database: testDbPath,
        timeoutMs: 100,
      });
      const hash = 'test-hash';

      await timeoutStore.register(hash);
      await timeoutStore.complete(hash, 'value');

      // Wait less than timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = await timeoutStore.waitFor(hash);
      expect(result).toBe('value');

      timeoutStore.destroy();
    });
  });

  describe('cleanup functionality', () => {
    it('should automatically clean up expired jobs', async () => {
      const cleanupStore = new SQLiteDedupeStore({
        database: testDbPath,
        timeoutMs: 50,
        cleanupIntervalMs: 10,
      });

      const hash = 'cleanup-test';
      await cleanupStore.register(hash);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      const isInProgress = await cleanupStore.isInProgress(hash);
      expect(isInProgress).toBe(false);

      cleanupStore.destroy();
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
        store.fail('non-existent', new Error('test')),
      ).resolves.not.toThrow();
    });

    it('should handle double completion', async () => {
      const hash = 'double-completion';
      await store.register(hash);
      await store.complete(hash, 'value1');

      // Second completion should not throw
      await expect(store.complete(hash, 'value2')).resolves.not.toThrow();

      const result = await store.waitFor(hash);
      expect(result).toBe('value1'); // First value should be preserved
    });

    it('should handle special characters in hash keys', async () => {
      const specialHash = 'hash-with-特殊字符-and-émojis-🚀';
      await store.register(specialHash);
      await store.complete(specialHash, 'special value');

      const result = await store.waitFor(specialHash);
      expect(result).toBe('special value');
    });

    it('should handle null and undefined values', async () => {
      const hash1 = 'null-test';
      const hash2 = 'undefined-test';

      await store.register(hash1);
      await store.complete(hash1, null);

      await store.register(hash2);
      await store.complete(hash2, undefined);

      const result1 = await store.waitFor(hash1);
      const result2 = await store.waitFor(hash2);

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });

  describe('concurrent access', () => {
    it('should handle many concurrent jobs', async () => {
      const promises: Array<Promise<string>> = [];
      const hashes: Array<string> = [];

      // Register many jobs concurrently
      for (let i = 0; i < 20; i++) {
        const hash = `concurrent-${i}`;
        hashes.push(hash);
        promises.push(store.register(hash));
      }

      await Promise.all(promises);

      // Complete all jobs
      const completionPromises = hashes.map((hash, i) =>
        store.complete(hash, `value-${i}`),
      );

      await Promise.all(completionPromises);

      // Check all results
      const results = await Promise.all(
        hashes.map((hash) => store.waitFor(hash)),
      );

      for (let i = 0; i < 20; i++) {
        expect(results[i]).toBe(`value-${i}`);
      }
    });
  });

  describe('destroy', () => {
    it('should close database connection when destroyed', () => {
      expect(() => store.destroy()).not.toThrow();
    });

    it('should be safe to call destroy multiple times', () => {
      expect(() => {
        store.destroy();
        store.destroy();
      }).not.toThrow();
    });

    it('should handle operations after destroy', async () => {
      store.destroy();

      // Should throw errors after destruction
      await expect(store.waitFor('test')).rejects.toThrow();
      await expect(store.register('test')).rejects.toThrow();
    });
  });

  describe('configuration', () => {
    it('should handle timeout of 0 (disabled)', async () => {
      const noTimeoutStore = new SQLiteDedupeStore({
        database: testDbPath,
        timeoutMs: 0,
      });

      const hash = 'no-timeout-test';
      await noTimeoutStore.register(hash);

      // Wait longer than normal timeout would be
      await new Promise((resolve) => setTimeout(resolve, 50));

      const isInProgress = await noTimeoutStore.isInProgress(hash);
      expect(isInProgress).toBe(true); // Should still be in progress

      noTimeoutStore.destroy();
    });

    it('should handle in-memory database', async () => {
      const memoryStore = new SQLiteDedupeStore({ database: ':memory:' });

      try {
        const hash = 'memory-test';
        await memoryStore.register(hash);
        await memoryStore.complete(hash, 'memory-value');

        const result = await memoryStore.waitFor(hash);
        expect(result).toBe('memory-value');
      } finally {
        memoryStore.destroy();
      }
    });
  });
});
