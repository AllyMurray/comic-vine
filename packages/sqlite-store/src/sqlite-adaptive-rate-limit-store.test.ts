import fs from 'fs';
import path from 'path';
import type { RateLimitConfig } from '@comic-vine/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteAdaptiveRateLimitStore } from './sqlite-adaptive-rate-limit-store.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SqliteAdaptiveRateLimitStore', () => {
  let store: SqliteAdaptiveRateLimitStore;
  const testDbPath = path.join(__dirname, 'test-adaptive-rate-limit.db');
  const defaultConfig: RateLimitConfig = { limit: 200, windowMs: 3600000 }; // 1 hour

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    store = new SqliteAdaptiveRateLimitStore({
      database: testDbPath,
      defaultConfig,
      adaptiveConfig: {
        monitoringWindowMs: 1000, // 1 second for fast tests
        highActivityThreshold: 5,
        moderateActivityThreshold: 2,
        recalculationIntervalMs: 100, // 100ms for fast tests
        sustainedInactivityThresholdMs: 2000, // 2 seconds for fast tests
        backgroundPauseOnIncreasingTrend: true,
        maxUserScaling: 2.0,
        minUserReserved: 10,
      },
    });
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('basic adaptive operations', () => {
    it('should allow user and background requests within limits', async () => {
      const resource = 'test-resource';

      // Test user requests
      const userCanProceed = await store.canProceed(resource, 'user');
      expect(userCanProceed).toBe(true);
      await store.record(resource, 'user');

      // Test background requests
      const backgroundCanProceed = await store.canProceed(
        resource,
        'background',
      );
      expect(backgroundCanProceed).toBe(true);
      await store.record(resource, 'background');
    });

    it('should provide adaptive status information', async () => {
      const resource = 'test-resource';

      const status = await store.getStatus(resource, 'user');
      expect(status).toHaveProperty('remaining');
      expect(status).toHaveProperty('resetTime');
      expect(status).toHaveProperty('limit');
      expect(status).toHaveProperty('adaptive');
      expect(status.adaptive).toHaveProperty('userReserved');
      expect(status.adaptive).toHaveProperty('backgroundMax');
      expect(status.adaptive).toHaveProperty('backgroundPaused');
      expect(status.adaptive).toHaveProperty('recentUserActivity');
      expect(status.adaptive).toHaveProperty('reason');
    });
  });

  describe('adaptive capacity allocation', () => {
    it('should start with recent zero activity allocation', async () => {
      const resource = 'test-resource';

      const status = await store.getStatus(resource);
      // With 0 user activity and no requests at all, it falls into "Initial state" strategy
      // which uses 30% base allocation (60 requests for 200 limit)
      expect(status.adaptive?.userReserved).toBe(60); // 30% of 200 = 60
      expect(status.adaptive?.backgroundMax).toBe(140); // 200 - 60 = 140
      expect(status.adaptive?.backgroundPaused).toBe(false);
      expect(status.adaptive?.reason).toContain('Initial state');
    });

    it('should adapt to moderate user activity', async () => {
      const resource = 'test-resource';

      // Simulate moderate user activity (3 requests)
      for (let i = 0; i < 3; i++) {
        await store.record(resource, 'user');
      }

      // Wait for recalculation
      await sleep(150);

      const status = await store.getStatus(resource);
      expect(status.adaptive?.userReserved).toBeGreaterThan(60); // Should get more than default
      expect(status.adaptive?.backgroundMax).toBeLessThan(140); // Background gets less
      expect(status.adaptive?.backgroundPaused).toBe(false);
      expect(status.adaptive?.reason).toContain('dynamic scaling');
    });

    it('should pause background on high user activity', async () => {
      const resource = 'test-resource';

      // Simulate high user activity (6 requests, above threshold of 5)
      for (let i = 0; i < 6; i++) {
        await store.record(resource, 'user');
      }

      // Wait for recalculation
      await sleep(150);

      const status = await store.getStatus(resource);
      expect(status.adaptive?.userReserved).toBeGreaterThan(100); // Users get significant capacity
      expect(status.adaptive?.backgroundPaused).toBe(true); // Background should be paused
      expect(status.adaptive?.reason).toContain('High user activity');
    });

    it('should scale up background during sustained inactivity', async () => {
      const resource = 'test-resource';

      // First, establish some baseline activity that will age out
      await store.record(resource, 'user');

      // Wait for sustained inactivity threshold
      await sleep(2100); // Just over 2 seconds

      // Wait for recalculation interval
      await sleep(150);

      const status = await store.getStatus(resource);
      expect(status.adaptive?.userReserved).toBe(0); // No user reservation
      expect(status.adaptive?.backgroundMax).toBe(200); // Full capacity to background
      expect(status.adaptive?.backgroundPaused).toBe(false);
      expect(status.adaptive?.reason).toContain('Sustained zero activity');
    });
  });

  describe('priority-based request handling', () => {
    it('should block background requests when paused', async () => {
      const resource = 'test-resource';

      // Create high user activity to pause background
      for (let i = 0; i < 6; i++) {
        await store.record(resource, 'user');
      }

      // Wait for recalculation
      await sleep(150);

      // Background requests should be blocked
      const backgroundCanProceed = await store.canProceed(
        resource,
        'background',
      );
      expect(backgroundCanProceed).toBe(false);

      // User requests should still work
      const userCanProceed = await store.canProceed(resource, 'user');
      expect(userCanProceed).toBe(true);
    });

    it('should handle priority-specific wait times', async () => {
      const resource = 'test-resource';

      // Create scenario where background is paused
      for (let i = 0; i < 6; i++) {
        await store.record(resource, 'user');
      }

      await sleep(150);

      const backgroundWaitTime = await store.getWaitTime(
        resource,
        'background',
      );
      expect(backgroundWaitTime).toBeGreaterThan(0); // Should have wait time

      const userWaitTime = await store.getWaitTime(resource, 'user');
      expect(userWaitTime).toBeLessThanOrEqual(backgroundWaitTime); // User should wait less
    });
  });

  describe('database persistence', () => {
    it('should persist priority information in database', async () => {
      const resource = 'test-resource';

      // Record requests with different priorities
      await store.record(resource, 'user');
      await store.record(resource, 'background');
      await store.record(resource, 'user');

      // Close and recreate store to test persistence
      await store.close();

      store = new SqliteAdaptiveRateLimitStore({
        database: testDbPath,
        defaultConfig,
        adaptiveConfig: {
          monitoringWindowMs: 1000,
          recalculationIntervalMs: 100,
        },
      });

      // Should load previous activity from database
      const status = await store.getStatus(resource);
      expect(status.adaptive?.recentUserActivity).toBeGreaterThan(0);
    });

    it('should handle database cleanup correctly', async () => {
      const resource = 'test-resource';

      // Add some requests
      for (let i = 0; i < 5; i++) {
        await store.record(resource, 'user');
        await store.record(resource, 'background');
      }

      // Clear all data
      await store.clear();

      const status = await store.getStatus(resource);
      expect(status.adaptive?.recentUserActivity).toBe(0);
      expect(status.remaining).toBe(200); // Should be back to full capacity
    });
  });

  describe('resource configuration', () => {
    it('should support per-resource rate limits', async () => {
      const resource1 = 'resource-1';
      const resource2 = 'resource-2';

      // Set different config for resource1
      const customConfig: RateLimitConfig = { limit: 100, windowMs: 1800000 };
      store.setResourceConfig(resource1, customConfig);

      const status1 = await store.getStatus(resource1);
      const status2 = await store.getStatus(resource2);

      expect(status1.limit).toBe(100);
      expect(status2.limit).toBe(200); // Default
    });

    it('should adapt capacity based on resource-specific limits', async () => {
      const resource = 'small-resource';

      // Set smaller limit
      store.setResourceConfig(resource, { limit: 50, windowMs: 3600000 });

      const status = await store.getStatus(resource);
      expect(status.limit).toBe(50);
      // With 0 activity and no requests, uses initial state strategy (30% of 50 = 15)
      expect(status.adaptive?.userReserved).toBe(15); // 30% of 50 = 15
      expect(status.adaptive?.backgroundMax).toBe(35); // 50 - 15 = 35
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide accurate statistics', async () => {
      const resource1 = 'resource-1';
      const resource2 = 'resource-2';

      // Add requests to multiple resources
      for (let i = 0; i < 3; i++) {
        await store.record(resource1, 'user');
        await store.record(resource2, 'background');
      }

      const stats = await store.getStats();
      expect(stats.totalRequests).toBe(6);
      expect(stats.uniqueResources).toBe(2);
    });

    it('should identify rate-limited resources', async () => {
      const resource = 'limited-resource';

      // Set very low limit and fill it
      store.setResourceConfig(resource, { limit: 2, windowMs: 3600000 });
      await store.record(resource, 'user');
      await store.record(resource, 'background');

      const stats = await store.getStats();
      expect(stats.rateLimitedResources).toContain(resource);
    });
  });

  describe('error handling', () => {
    it('should throw error when accessing destroyed store', async () => {
      await store.close();

      await expect(store.canProceed('test')).rejects.toThrow(
        'Rate limit store has been destroyed',
      );
      await expect(store.record('test')).rejects.toThrow(
        'Rate limit store has been destroyed',
      );
      await expect(store.getStatus('test')).rejects.toThrow(
        'Rate limit store has been destroyed',
      );
      await expect(store.reset('test')).rejects.toThrow(
        'Rate limit store has been destroyed',
      );
    });

    it('should handle missing database gracefully', async () => {
      // Create store with in-memory database
      const memStore = new SqliteAdaptiveRateLimitStore({
        database: ':memory:',
        adaptiveConfig: {
          monitoringWindowMs: 1000,
        },
      });

      try {
        const canProceed = await memStore.canProceed('test');
        expect(canProceed).toBe(true);
      } finally {
        await memStore.close();
      }
    });
  });

  describe('memory management', () => {
    it('should clean up old activity metrics', async () => {
      const resource = 'test-resource';

      // Add requests and let them age out
      await store.record(resource, 'user');

      // Wait for monitoring window to expire
      await sleep(1100); // Just over 1 second

      // Add another request to trigger cleanup
      await store.record(resource, 'user');
      await sleep(150); // Wait for recalculation

      const status = await store.getStatus(resource);
      expect(status.adaptive?.recentUserActivity).toBe(1); // Only recent request should count
    });

    it('should handle concurrent access correctly', async () => {
      const resource = 'concurrent-resource';

      // Simulate concurrent requests
      const promises: Array<Promise<unknown>> = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          store.canProceed(resource, i % 2 === 0 ? 'user' : 'background'),
        );
        promises.push(
          store.record(resource, i % 2 === 0 ? 'user' : 'background'),
        );
      }

      await Promise.all(promises);

      const status = await store.getStatus(resource);
      expect(status.adaptive?.recentUserActivity).toBeGreaterThan(0);
    });
  });
});
