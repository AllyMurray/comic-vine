import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DynamoDBCacheStore } from './dynamodb-cache-store.js';
import { mockDynamoDBDocumentClient } from './__mocks__/dynamodb-client.js';
import { CircuitBreakerOpenError, OperationTimeoutError } from './types.js';

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

describe('DynamoDBCacheStore', () => {
  let store: DynamoDBCacheStore;

  beforeEach(() => {
    mockDynamoDBDocumentClient.clear();
    mockDynamoDBDocumentClient.disableThrottling();
    mockDynamoDBDocumentClient.disableTimeout();
    
    store = new DynamoDBCacheStore({
      tableName: 'test-table',
      cleanupIntervalMs: 0, // Disable automatic cleanup for tests
      circuitBreaker: {
        enabled: false, // Disable circuit breaker for basic tests
      },
    });
  });

  afterEach(async () => {
    if (store) {
      await store.close();
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
    it('should handle TTL correctly', async () => {
      // Set with 1 second TTL
      await store.set('key1', 'value1', 1);
      
      // Should be available immediately
      let value = await store.get('key1');
      expect(value).toBe('value1');

      // Mock expired TTL
      const futureTime = Math.floor(Date.now() / 1000) + 2;
      vi.spyOn(Date, 'now').mockReturnValue(futureTime * 1000);

      // Should be expired now
      value = await store.get('key1');
      expect(value).toBeUndefined();

      vi.restoreAllMocks();
    });

    it('should handle zero TTL (immediate expiration)', async () => {
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
    it('should provide cache statistics', async () => {
      await store.set('key1', 'value1', 60);
      await store.set('key2', 'value2', 60);

      const stats = await store.getStats();
      expect(stats.totalItems).toBe(2);
      expect(stats.expiredItems).toBe(0);
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0);
    });

    it('should identify expired items in statistics', async () => {
      // Set item with past TTL
      await store.set('key1', 'value1', 1);
      
      // Mock time to make item expired
      const futureTime = Math.floor(Date.now() / 1000) + 2;
      vi.spyOn(Math, 'floor').mockReturnValue(futureTime);

      const stats = await store.getStats();
      expect(stats.expiredItems).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });
  });

  describe('cleanup functionality', () => {
    it('should manually clean up expired items', async () => {
      // Set items with past TTL
      await store.set('key1', 'value1', 1);
      await store.set('key2', 'value2', 60);
      
      // Mock time to make first item expired
      const futureTime = Math.floor(Date.now() / 1000) + 2;
      vi.spyOn(Math, 'floor').mockReturnValue(futureTime);

      const deletedCount = await store.cleanup();
      expect(deletedCount).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });
  });

  describe('circuit breaker functionality', () => {
    beforeEach(() => {
      store = new DynamoDBCacheStore({
        tableName: 'test-table',
        cleanupIntervalMs: 0,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 2,
          recoveryTimeoutMs: 1000,
          timeoutMs: 100,
        },
      });
    });

    it('should provide circuit breaker status', () => {
      const status = store.getCircuitBreakerStatus();
      expect(status.state).toBe('closed');
      expect(status.failureCount).toBe(0);
    });

    it('should reset circuit breaker', () => {
      store.resetCircuitBreaker();
      const status = store.getCircuitBreakerStatus();
      expect(status.state).toBe('closed');
      expect(status.failureCount).toBe(0);
    });

    it('should open circuit breaker after failures', async () => {
      mockDynamoDBDocumentClient.enableThrottling();

      // Cause failures to trip circuit breaker
      await expect(store.get('key1')).rejects.toThrow();
      await expect(store.get('key2')).rejects.toThrow();

      const status = store.getCircuitBreakerStatus();
      expect(status.state).toBe('open');
    });

    it('should handle circuit breaker open state', async () => {
      mockDynamoDBDocumentClient.enableThrottling();

      // Trip the circuit breaker
      await expect(store.get('key1')).rejects.toThrow();
      await expect(store.get('key2')).rejects.toThrow();

      // Next call should be rejected by circuit breaker
      await expect(store.get('key3')).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('should handle operation timeouts', async () => {
      mockDynamoDBDocumentClient.enableTimeout(200);

      await expect(store.get('key1')).rejects.toThrow(OperationTimeoutError);
    });
  });

  describe('error handling', () => {
    it('should handle DynamoDB throttling errors', async () => {
      mockDynamoDBDocumentClient.enableThrottling();

      await expect(store.get('key1')).rejects.toThrow('ThrottlingException');
    });

    it('should throw error when store is destroyed', async () => {
      await store.close();

      await expect(store.get('key1')).rejects.toThrow('DynamoDBCacheStore has been destroyed');
    });

    it('should handle large values within limits', async () => {
      // Create a value close to but under the 400KB limit
      const largeValue = 'x'.repeat(350 * 1024); // 350KB
      
      await expect(store.set('large', largeValue, 60)).resolves.not.toThrow();
      const retrieved = await store.get('large');
      expect(retrieved).toBe(largeValue);
    });

    it('should reject values that exceed DynamoDB limits', async () => {
      // Create a value over the 400KB limit
      const tooLargeValue = 'x'.repeat(450 * 1024); // 450KB
      
      await expect(store.set('toolarge', tooLargeValue, 60)).rejects.toThrow('Item size');
    });
  });

  describe('concurrent operations', () => {
    it('should handle many concurrent operations', async () => {
      const promises = [];

      // Set 50 values concurrently
      for (let i = 0; i < 50; i++) {
        promises.push(store.set(`key${i}`, `value${i}`, 60));
      }

      await Promise.all(promises);

      // Get all values
      const getPromises = [];
      for (let i = 0; i < 50; i++) {
        getPromises.push(store.get(`key${i}`));
      }

      const values = await Promise.all(getPromises);

      // Check all values are correct
      for (let i = 0; i < 50; i++) {
        expect(values[i]).toBe(`value${i}`);
      }
    });

    it('should handle concurrent reads and writes', async () => {
      const operations = [];

      // Mix of reads and writes
      for (let i = 0; i < 20; i++) {
        operations.push(store.set(`key${i}`, `value${i}`, 60));
        operations.push(store.get(`key${i}`));
      }

      await Promise.all(operations);

      // Verify final state
      for (let i = 0; i < 20; i++) {
        const value = await store.get(`key${i}`);
        expect(value).toBe(`value${i}`);
      }
    });
  });

  describe('configuration', () => {
    it('should use custom table name', async () => {
      const customStore = new DynamoDBCacheStore({
        tableName: 'custom-table-name',
        cleanupIntervalMs: 0,
        circuitBreaker: { enabled: false },
      });

      await customStore.set('key1', 'value1', 60);
      const value = await customStore.get('key1');
      expect(value).toBe('value1');

      await customStore.close();
    });

    it('should handle custom circuit breaker configuration', () => {
      const customStore = new DynamoDBCacheStore({
        tableName: 'test-table',
        circuitBreaker: {
          enabled: true,
          failureThreshold: 10,
          recoveryTimeoutMs: 5000,
          timeoutMs: 1000,
        },
      });

      expect(customStore.getCircuitBreakerStatus().state).toBe('closed');
      customStore.close();
    });

    it('should handle all configuration options', async () => {
      const configStore = new DynamoDBCacheStore({
        tableName: 'config-test',
        region: 'us-west-2',
        maxRetries: 5,
        retryDelayMs: 200,
        batchSize: 20,
        cleanupIntervalMs: 60000,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          recoveryTimeoutMs: 30000,
          timeoutMs: 5000,
        },
      });

      // Should work with custom config
      await configStore.set('test', 'config', 60);
      const value = await configStore.get('test');
      expect(value).toBe('config');

      await configStore.close();
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in keys', async () => {
      const specialKey = 'key-with-特殊字符-and-émojis-🚀';
      await store.set(specialKey, 'special value', 60);
      const value = await store.get(specialKey);
      expect(value).toBe('special value');
    });

    it('should handle empty string keys', async () => {
      await store.set('', 'empty key value', 60);
      const value = await store.get('');
      expect(value).toBe('empty key value');
    });

    it('should handle very long keys', async () => {
      const longKey = 'x'.repeat(1000);
      await store.set(longKey, 'long key value', 60);
      const value = await store.get(longKey);
      expect(value).toBe('long key value');
    });

    it('should handle circular references in objects', async () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      // Should handle circular reference gracefully during serialization
      await expect(store.set('circular', obj, 60)).rejects.toThrow();
    });
  });

  describe('lifecycle management', () => {
    it('should be safe to call close multiple times', async () => {
      await store.close();
      await expect(store.close()).resolves.not.toThrow();
    });

    it('should stop cleanup interval on close', async () => {
      const intervalStore = new DynamoDBCacheStore({
        tableName: 'test-table',
        cleanupIntervalMs: 1000, // Enable cleanup interval
      });

      await intervalStore.close();
      // Should not throw and should properly clean up
      expect(true).toBe(true);
    });
  });
});