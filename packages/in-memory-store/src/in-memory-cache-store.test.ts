import { describe, it, expect, beforeEach, afterEach, vi as _vi } from 'vitest';
import { InMemoryCacheStore } from './in-memory-cache-store.js';

describe('InMemoryCacheStore', () => {
  let store: InMemoryCacheStore;

  beforeEach(() => {
    store = new InMemoryCacheStore();
  });

  afterEach(() => {
    if (store) {
      store.destroy();
    }
  });

  describe('basic operations', () => {
    it('should set and get values', async () => {
      await store.set('key1', 'value1', 60);
      const value = await store.get('key1');
      expect(value).toBe('value1');
    });

    it('should return undefined for non-existent keys', async () => {
      const value = await store.get('non-existent');
      expect(value).toBeUndefined();
    });

    it('should overwrite existing values', async () => {
      await store.set('key1', 'value1', 60);
      await store.set('key1', 'value2', 60);
      const value = await store.get('key1');
      expect(value).toBe('value2');
    });

    it('should delete values', async () => {
      await store.set('key1', 'value1', 60);
      await store.delete('key1');
      const value = await store.get('key1');
      expect(value).toBeUndefined();
    });

    it('should handle deletion of non-existent keys', async () => {
      await expect(store.delete('non-existent')).resolves.not.toThrow();
    });

    it('should clear all values', async () => {
      await store.set('key1', 'value1', 60);
      await store.set('key2', 'value2', 60);
      await store.clear();

      const value1 = await store.get('key1');
      const value2 = await store.get('key2');

      expect(value1).toBeUndefined();
      expect(value2).toBeUndefined();
    });
  });

  describe('TTL functionality', () => {
    it('should expire values after TTL', async () => {
      await store.set('key1', 'value1', 0.001); // 1ms TTL

      // Should be available immediately
      let value = await store.get('key1');
      expect(value).toBe('value1');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      value = await store.get('key1');
      expect(value).toBeUndefined();
    });

    it('should not expire values before TTL', async () => {
      await store.set('key1', 'value1', 10); // 10 seconds TTL

      // Should be available after a short delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      const value = await store.get('key1');
      expect(value).toBe('value1');
    });

    it('should handle zero TTL', async () => {
      await store.set('key1', 'value1', 0);

      // Should be expired immediately
      const value = await store.get('key1');
      expect(value).toBeUndefined();
    });

    it('should handle negative TTL', async () => {
      await store.set('key1', 'value1', -1);

      // Should be expired immediately
      const value = await store.get('key1');
      expect(value).toBeUndefined();
    });
  });

  describe('data types', () => {
    it('should handle string values', async () => {
      await store.set('key1', 'string value', 60);
      const value = await store.get('key1');
      expect(value).toBe('string value');
    });

    it('should handle number values', async () => {
      await store.set('key1', 42, 60);
      const value = await store.get('key1');
      expect(value).toBe(42);
    });

    it('should handle boolean values', async () => {
      await store.set('key1', true, 60);
      const value = await store.get('key1');
      expect(value).toBe(true);
    });

    it('should handle object values', async () => {
      const obj = { id: 1, name: 'test', nested: { value: 'nested' } };
      await store.set('key1', obj, 60);
      const value = await store.get('key1');
      expect(value).toEqual(obj);
    });

    it('should handle array values', async () => {
      const arr = [1, 2, 3, { id: 4 }];
      await store.set('key1', arr, 60);
      const value = await store.get('key1');
      expect(value).toEqual(arr);
    });

    it('should handle null values', async () => {
      await store.set('key1', null, 60);
      const value = await store.get('key1');
      expect(value).toBeNull();
    });

    it('should handle undefined values', async () => {
      await store.set('key1', undefined, 60);
      const value = await store.get('key1');
      expect(value).toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', async () => {
      await store.set('key1', 'value1', 60);
      await store.set('key2', 'value2', 60);

      const stats = store.getStats();
      expect(stats.totalItems).toBe(2);
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
    });

    it('should update statistics after operations', async () => {
      let stats = store.getStats();
      expect(stats.totalItems).toBe(0);

      await store.set('key1', 'value1', 60);
      stats = store.getStats();
      expect(stats.totalItems).toBe(1);

      await store.delete('key1');
      stats = store.getStats();
      expect(stats.totalItems).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should automatically clean up expired items', async () => {
      // Create store with very short cleanup interval
      const cleanupStore = new InMemoryCacheStore({ cleanupIntervalMs: 10 });

      await cleanupStore.set('key1', 'value1', 0.001); // 1ms TTL

      // Wait for cleanup to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = cleanupStore.getStats();
      expect(stats.totalItems).toBe(0);

      cleanupStore.destroy();
    });

    it('should not clean up unexpired items', async () => {
      // Create store with very short cleanup interval
      const cleanupStore = new InMemoryCacheStore({ cleanupIntervalMs: 10 });

      await cleanupStore.set('key1', 'value1', 10); // 10 seconds TTL

      // Wait for cleanup to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = cleanupStore.getStats();
      expect(stats.totalItems).toBe(1);

      cleanupStore.destroy();
    });
  });

  describe('configuration', () => {
    it('should use custom cleanup interval', async () => {
      const cleanupStore = new InMemoryCacheStore({ cleanupIntervalMs: 5000 });

      // Should have created the store without throwing
      expect(cleanupStore).toBeDefined();

      cleanupStore.destroy();
    });

    it('should handle cleanup interval of 0 (disabled)', async () => {
      const cleanupStore = new InMemoryCacheStore({ cleanupIntervalMs: 0 });

      // Should work without automatic cleanup
      await cleanupStore.set('key1', 'value1', 60);
      const value = await cleanupStore.get('key1');
      expect(value).toBe('value1');

      cleanupStore.destroy();
    });
  });

  describe('edge cases', () => {
    it('should handle very large values', async () => {
      const largeValue = 'x'.repeat(1000000); // 1MB string
      await store.set('large', largeValue, 60);
      const value = await store.get('large');
      expect(value).toBe(largeValue);
    });

    it('should handle many concurrent operations', async () => {
      const promises = [];

      // Set 100 values concurrently
      for (let i = 0; i < 100; i++) {
        promises.push(store.set(`key${i}`, `value${i}`, 60));
      }

      await Promise.all(promises);

      // Get all values
      const getPromises = [];
      for (let i = 0; i < 100; i++) {
        getPromises.push(store.get(`key${i}`));
      }

      const values = await Promise.all(getPromises);

      // Check all values are correct
      for (let i = 0; i < 100; i++) {
        expect(values[i]).toBe(`value${i}`);
      }
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key-with-特殊字符-and-émojis-🚀';
      await store.set(specialKey, 'special value', 60);
      const value = await store.get(specialKey);
      expect(value).toBe('special value');
    });
  });

  describe('destroy', () => {
    it('should clear all data when destroyed', async () => {
      await store.set('key1', 'value1', 60);
      await store.set('key2', 'value2', 60);

      store.destroy();

      const value1 = await store.get('key1');
      const value2 = await store.get('key2');

      expect(value1).toBeUndefined();
      expect(value2).toBeUndefined();
    });

    it('should be safe to call destroy multiple times', () => {
      expect(() => {
        store.destroy();
        store.destroy();
      }).not.toThrow();
    });
  });
});
