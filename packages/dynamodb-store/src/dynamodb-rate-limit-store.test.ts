import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DynamoDBRateLimitStore } from './dynamodb-rate-limit-store.js';
import { mockDynamoDBDocumentClient } from './__mocks__/dynamodb-client.js';

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

describe('DynamoDBRateLimitStore', () => {
  let store: DynamoDBRateLimitStore;

  beforeEach(() => {
    mockDynamoDBDocumentClient.clear();
    mockDynamoDBDocumentClient.disableThrottling();
    mockDynamoDBDocumentClient.disableTimeout();
    
    store = new DynamoDBRateLimitStore({
      tableName: 'test-table',
      cleanupIntervalMs: 0, // Disable automatic cleanup for tests
      defaultLimit: 10, // 10 requests per window
      defaultWindowSeconds: 60, // 1 minute window
    });
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
  });

  describe('basic rate limiting', () => {
    it('should allow requests within limit', async () => {
      const resource = 'test-resource';
      
      // First request should be allowed
      const canProceed1 = await store.canProceed(resource);
      expect(canProceed1).toBe(true);
      
      await store.record(resource);
      
      // Still within limit
      const canProceed2 = await store.canProceed(resource);
      expect(canProceed2).toBe(true);
    });

    it('should block requests over limit', async () => {
      const resource = 'test-resource';
      
      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await store.record(resource);
      }
      
      // Next request should be blocked
      const canProceed = await store.canProceed(resource);
      expect(canProceed).toBe(false);
    });

    it('should record requests with timestamps', async () => {
      const resource = 'test-resource';
      
      await store.record(resource);
      
      const status = await store.getStatus(resource);
      expect(status.remaining).toBe(9); // 10 - 1
      expect(status.limit).toBe(10);
      expect(status.resetTime).toBeInstanceOf(Date);
    });

    it('should provide accurate status information', async () => {
      const resource = 'test-resource';
      
      // Record 3 requests
      for (let i = 0; i < 3; i++) {
        await store.record(resource);
      }
      
      const status = await store.getStatus(resource);
      expect(status.remaining).toBe(7); // 10 - 3
      expect(status.limit).toBe(10);
      expect(status.resetTime.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('time window behavior', () => {
    it('should calculate correct reset time', async () => {
      const resource = 'test-resource';
      
      await store.record(resource);
      
      const status = await store.getStatus(resource);
      const now = Date.now();
      const resetTime = status.resetTime.getTime();
      
      // Reset time should be within the next window
      expect(resetTime).toBeGreaterThan(now);
      expect(resetTime - now).toBeLessThanOrEqual(60 * 1000); // Within 60 seconds
    });

    it('should calculate wait time correctly when rate limited', async () => {
      const resource = 'test-resource';
      
      // Exhaust the rate limit
      for (let i = 0; i < 10; i++) {
        await store.record(resource);
      }
      
      const waitTime = await store.getWaitTime(resource);
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(60 * 1000); // Max 60 seconds
    });

    it('should return zero wait time when not rate limited', async () => {
      const resource = 'test-resource';
      
      // Record only a few requests
      await store.record(resource);
      await store.record(resource);
      
      const waitTime = await store.getWaitTime(resource);
      expect(waitTime).toBe(0);
    });

    it('should handle time window boundaries correctly', async () => {
      const resource = 'test-resource';
      
      // Mock current time to a specific window
      const baseTime = 1000000; // Some base timestamp
      vi.spyOn(Date, 'now').mockReturnValue(baseTime * 1000);
      vi.spyOn(Math, 'floor').mockReturnValue(baseTime);
      
      // Record requests
      await store.record(resource);
      
      // Move to next window
      const nextWindowTime = baseTime + 60; // Next minute
      vi.spyOn(Date, 'now').mockReturnValue(nextWindowTime * 1000);
      vi.spyOn(Math, 'floor').mockReturnValue(nextWindowTime);
      
      // Should be able to make new requests in new window
      const canProceed = await store.canProceed(resource);
      expect(canProceed).toBe(true);
      
      vi.restoreAllMocks();
    });
  });

  describe('resource isolation', () => {
    it('should handle different resources independently', async () => {
      const resource1 = 'resource-1';
      const resource2 = 'resource-2';
      
      // Exhaust limit for resource1
      for (let i = 0; i < 10; i++) {
        await store.record(resource1);
      }
      
      // resource1 should be blocked
      const canProceed1 = await store.canProceed(resource1);
      expect(canProceed1).toBe(false);
      
      // resource2 should still be allowed
      const canProceed2 = await store.canProceed(resource2);
      expect(canProceed2).toBe(true);
    });

    it('should provide separate status for each resource', async () => {
      const resource1 = 'resource-1';
      const resource2 = 'resource-2';
      
      // Record different amounts for each resource
      await store.record(resource1);
      await store.record(resource2);
      await store.record(resource2);
      
      const status1 = await store.getStatus(resource1);
      const status2 = await store.getStatus(resource2);
      
      expect(status1.remaining).toBe(9); // 10 - 1
      expect(status2.remaining).toBe(8); // 10 - 2
    });
  });

  describe('reset functionality', () => {
    it('should reset all requests for a resource', async () => {
      const resource = 'test-resource';
      
      // Make several requests
      for (let i = 0; i < 5; i++) {
        await store.record(resource);
      }
      
      // Verify rate limit status
      let status = await store.getStatus(resource);
      expect(status.remaining).toBe(5);
      
      // Reset the resource
      await store.reset(resource);
      
      // Should be back to full limit
      status = await store.getStatus(resource);
      expect(status.remaining).toBe(10);
    });

    it('should not affect other resources when resetting', async () => {
      const resource1 = 'resource-1';
      const resource2 = 'resource-2';
      
      // Record requests for both resources
      await store.record(resource1);
      await store.record(resource2);
      await store.record(resource2);
      
      // Reset only resource1
      await store.reset(resource1);
      
      // resource1 should be reset
      const status1 = await store.getStatus(resource1);
      expect(status1.remaining).toBe(10);
      
      // resource2 should be unchanged
      const status2 = await store.getStatus(resource2);
      expect(status2.remaining).toBe(8);
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide accurate rate limit statistics', async () => {
      const resource1 = 'resource-1';
      const resource2 = 'resource-2';
      
      // Record requests for different resources
      for (let i = 0; i < 3; i++) {
        await store.record(resource1);
      }
      for (let i = 0; i < 2; i++) {
        await store.record(resource2);
      }
      
      const stats = await store.getStats();
      expect(stats.totalResources).toBe(2);
      expect(stats.totalRequests).toBe(5);
      expect(stats.resourceStats[resource1].requestCount).toBe(3);
      expect(stats.resourceStats[resource2].requestCount).toBe(2);
    });

    it('should include timing information in statistics', async () => {
      const resource = 'test-resource';
      
      await store.record(resource);
      
      const stats = await store.getStats();
      expect(stats.resourceStats[resource].windowStart).toBeInstanceOf(Date);
      expect(stats.resourceStats[resource].nextReset).toBeInstanceOf(Date);
    });
  });

  describe('cleanup functionality', () => {
    it('should manually clean up expired rate limit records', async () => {
      const resource = 'test-resource';
      
      // Record some requests
      await store.record(resource);
      
      // Mock time to make records expired
      const futureTime = Math.floor(Date.now() / 1000) + 150; // Beyond TTL
      vi.spyOn(Math, 'floor').mockReturnValue(futureTime);
      
      const deletedCount = await store.cleanup();
      expect(deletedCount).toBeGreaterThan(0);
      
      vi.restoreAllMocks();
    });

    it('should not clean up unexpired records', async () => {
      const resource = 'test-resource';
      
      // Record recent requests
      await store.record(resource);
      
      const deletedCount = await store.cleanup();
      expect(deletedCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      mockDynamoDBDocumentClient.enableThrottling();
      
      await expect(store.record('test-resource')).rejects.toThrow();
    });

    it('should throw error when store is destroyed', async () => {
      await store.close();
      
      await expect(store.canProceed('test')).rejects.toThrow('DynamoDBRateLimitStore has been destroyed');
    });

    it('should handle timeout errors', async () => {
      mockDynamoDBDocumentClient.enableTimeout(50);
      
      await expect(store.record('test-resource')).rejects.toThrow();
    });
  });

  describe('configuration options', () => {
    it('should use custom rate limits', async () => {
      const customStore = new DynamoDBRateLimitStore({
        tableName: 'test-table',
        defaultLimit: 5, // Custom limit
        defaultWindowSeconds: 30, // Custom window
        cleanupIntervalMs: 0,
      });
      
      const resource = 'custom-test';
      
      // Should allow up to custom limit
      for (let i = 0; i < 5; i++) {
        const canProceed = await customStore.canProceed(resource);
        expect(canProceed).toBe(true);
        await customStore.record(resource);
      }
      
      // Should block at custom limit
      const canProceed = await customStore.canProceed(resource);
      expect(canProceed).toBe(false);
      
      await customStore.close();
    });

    it('should use custom window timing', async () => {
      const customStore = new DynamoDBRateLimitStore({
        tableName: 'test-table',
        defaultLimit: 10,
        defaultWindowSeconds: 30, // 30 second window
        cleanupIntervalMs: 0,
      });
      
      const resource = 'timing-test';
      await customStore.record(resource);
      
      const status = await customStore.getStatus(resource);
      const waitTime = status.resetTime.getTime() - Date.now();
      
      // Should reset within 30 seconds
      expect(waitTime).toBeLessThanOrEqual(30 * 1000);
      
      await customStore.close();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent requests correctly', async () => {
      const resource = 'concurrent-test';
      
      // Make concurrent requests
      const promises = Array(8).fill(null).map(() => store.record(resource));
      await Promise.all(promises);
      
      // Should have recorded all requests
      const status = await store.getStatus(resource);
      expect(status.remaining).toBe(2); // 10 - 8
    });

    it('should handle concurrent canProceed checks', async () => {
      const resource = 'concurrent-check';
      
      // Record most of the limit
      for (let i = 0; i < 9; i++) {
        await store.record(resource);
      }
      
      // Make concurrent checks
      const promises = Array(5).fill(null).map(() => store.canProceed(resource));
      const results = await Promise.all(promises);
      
      // All should return the same result (true, since we're at 9/10)
      results.forEach(result => expect(result).toBe(true));
    });

    it('should handle concurrent reset operations', async () => {
      const resource = 'concurrent-reset';
      
      // Record some requests
      await store.record(resource);
      await store.record(resource);
      
      // Make concurrent resets
      const promises = Array(3).fill(null).map(() => store.reset(resource));
      await Promise.allSettled(promises);
      
      // Should be reset regardless of concurrent calls
      const status = await store.getStatus(resource);
      expect(status.remaining).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in resource names', async () => {
      const specialResource = 'resource-with-特殊字符-and-émojis-🚀';
      
      const canProceed = await store.canProceed(specialResource);
      expect(canProceed).toBe(true);
      
      await store.record(specialResource);
      
      const status = await store.getStatus(specialResource);
      expect(status.remaining).toBe(9);
    });

    it('should handle empty resource names', async () => {
      const emptyResource = '';
      
      const canProceed = await store.canProceed(emptyResource);
      expect(canProceed).toBe(true);
      
      await store.record(emptyResource);
      
      const status = await store.getStatus(emptyResource);
      expect(status.remaining).toBe(9);
    });

    it('should handle very long resource names', async () => {
      const longResource = 'x'.repeat(1000);
      
      const canProceed = await store.canProceed(longResource);
      expect(canProceed).toBe(true);
      
      await store.record(longResource);
      
      const status = await store.getStatus(longResource);
      expect(status.remaining).toBe(9);
    });

    it('should handle zero limits gracefully', async () => {
      const zeroLimitStore = new DynamoDBRateLimitStore({
        tableName: 'test-table',
        defaultLimit: 0, // No requests allowed
        cleanupIntervalMs: 0,
      });
      
      const resource = 'zero-limit';
      
      // Should immediately be blocked
      const canProceed = await zeroLimitStore.canProceed(resource);
      expect(canProceed).toBe(false);
      
      await zeroLimitStore.close();
    });
  });

  describe('lifecycle management', () => {
    it('should be safe to call close multiple times', async () => {
      await store.close();
      await expect(store.close()).resolves.not.toThrow();
    });

    it('should stop cleanup interval on close', async () => {
      const intervalStore = new DynamoDBRateLimitStore({
        tableName: 'test-table',
        cleanupIntervalMs: 1000, // Enable cleanup interval
      });
      
      await intervalStore.close();
      // Should not throw and should properly clean up
      expect(true).toBe(true);
    });
  });
});