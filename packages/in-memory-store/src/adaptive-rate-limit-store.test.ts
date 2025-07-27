import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdaptiveRateLimitStore } from './adaptive-rate-limit-store.js';

describe('AdaptiveRateLimitStore', () => {
  let store: AdaptiveRateLimitStore;
  const resource = 'test-resource';

  beforeEach(() => {
    store = new AdaptiveRateLimitStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create store with default configuration', () => {
      expect(store).toBeDefined();
    });

    it('should accept custom adaptive configuration', () => {
      const customStore = new AdaptiveRateLimitStore({
        adaptiveConfig: {
          highActivityThreshold: 15,
          maxUserScaling: 3.0,
        },
      });

      expect(customStore).toBeDefined();
    });
  });

  describe('canProceed and record flow', () => {
    it('should allow initial requests for both priorities', async () => {
      expect(await store.canProceed(resource, 'user')).toBe(true);
      expect(await store.canProceed(resource, 'background')).toBe(true);
    });

    it('should track user and background requests separately', async () => {
      // Record some user requests
      await store.record(resource, 'user');
      await store.record(resource, 'user');

      // Record some background requests
      await store.record(resource, 'background');
      await store.record(resource, 'background');
      await store.record(resource, 'background');

      const status = await store.getStatus(resource);
      expect(status.adaptive?.recentUserActivity).toBe(2);
    });

    it('should default to background priority when not specified', async () => {
      await store.record(resource); // Default to background
      await store.record(resource, 'background'); // Explicit background

      const status = await store.getStatus(resource);
      expect(status.adaptive?.recentUserActivity).toBe(0); // No user requests
    });
  });

  describe('adaptive capacity allocation', () => {
    it('should provide more capacity to users during high activity', async () => {
      // Simulate high user activity (15 requests > 10 threshold)
      for (let i = 0; i < 15; i++) {
        await store.record(resource, 'user');
        vi.advanceTimersByTime(30 * 1000); // 30 seconds between requests
      }

      // Force recalculation by advancing time
      vi.advanceTimersByTime(35 * 1000);

      const status = await store.getStatus(resource);

      expect(status.adaptive?.userReserved).toBeGreaterThan(100); // More than 50% of 200
      expect(status.adaptive?.recentUserActivity).toBe(15);
      expect(status.adaptive?.reason).toContain('High user activity');
    });

    it('should pause background requests during high user activity with increasing trend', async () => {
      // Create increasing trend - more recent requests
      const now = Date.now();

      // Simulate pattern that creates increasing trend
      for (let i = 0; i < 8; i++) {
        vi.setSystemTime(new Date(now - (7 - i) * 60 * 1000)); // Recent requests
        await store.record(resource, 'user');
      }

      // Add fewer older requests to establish increasing trend
      vi.setSystemTime(new Date(now - 10 * 60 * 1000));
      await store.record(resource, 'user');
      await store.record(resource, 'user');

      vi.setSystemTime(new Date(now));

      // Force recalculation
      vi.advanceTimersByTime(35 * 1000);

      expect(await store.canProceed(resource, 'user')).toBe(true);
      expect(await store.canProceed(resource, 'background')).toBe(false); // Should be paused

      const status = await store.getStatus(resource);
      expect(status.adaptive?.backgroundPaused).toBe(true);
    });

    it('should scale up background capacity during low user activity', async () => {
      // No user activity, should give more to background
      await store.record(resource, 'background');

      const status = await store.getStatus(resource);

      expect(status.adaptive?.userReserved).toBeLessThan(100); // Less than 50%
      expect(status.adaptive?.backgroundMax).toBeGreaterThan(100); // More than 50%
      expect(status.adaptive?.reason).toContain('background scale up');
    });

    it('should give full capacity to background after sustained inactivity', async () => {
      // Simulate sustained inactivity (no recent requests)
      // But record old request to avoid completely empty state
      vi.setSystemTime(new Date('2023-01-01T10:00:00Z')); // 2 hours ago
      await store.record(resource, 'user');

      vi.setSystemTime(new Date('2023-01-01T12:00:00Z')); // Back to present

      // Force recalculation after sustained inactivity period
      vi.advanceTimersByTime(35 * 60 * 1000); // 35 minutes

      const status = await store.getStatus(resource);

      expect(status.adaptive?.userReserved).toBe(0);
      expect(status.adaptive?.backgroundMax).toBe(200);
      expect(status.adaptive?.reason).toContain('full capacity to background');
    });
  });

  describe('rate limiting enforcement', () => {
    it('should reject requests when capacity is exceeded', async () => {
      // Fill up user capacity - even in high activity mode, user gets max 180 out of 200
      // So recording 185 requests should exceed capacity
      for (let i = 0; i < 185; i++) {
        await store.record(resource, 'user');
      }

      expect(await store.canProceed(resource, 'user')).toBe(false);
    });

    it('should reject background requests when capacity is exceeded', async () => {
      // With no user activity, background gets almost everything (195 out of 200)
      // Recording 200 should exceed that
      for (let i = 0; i < 200; i++) {
        await store.record(resource, 'background');
      }

      expect(await store.canProceed(resource, 'background')).toBe(false);
    });

    it('should allow requests in different priority pools independently', async () => {
      // Create store with background pause disabled to test independent pools
      const noPauseStore = new AdaptiveRateLimitStore({
        adaptiveConfig: {
          backgroundPauseOnIncreasingTrend: false,
        },
      });

      // Fill up user capacity (high activity gives 180 capacity)
      for (let i = 0; i < 185; i++) {
        await noPauseStore.record(resource, 'user');
      }

      // User requests should be blocked, but background should still work
      expect(await noPauseStore.canProceed(resource, 'user')).toBe(false);
      expect(await noPauseStore.canProceed(resource, 'background')).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive status information', async () => {
      await store.record(resource, 'user');
      await store.record(resource, 'background');

      const status = await store.getStatus(resource);

      expect(status.remaining).toBeGreaterThanOrEqual(0);
      expect(status.resetTime).toBeInstanceOf(Date);
      expect(status.limit).toBe(200);
      expect(status.adaptive).toBeDefined();
      expect(status.adaptive?.userReserved).toBeGreaterThan(0);
      expect(status.adaptive?.backgroundMax).toBeGreaterThan(0);
      expect(status.adaptive?.recentUserActivity).toBe(1);
      expect(status.adaptive?.reason).toBeDefined();
    });

    it('should calculate remaining capacity correctly', async () => {
      // Use some capacity
      await store.record(resource, 'user');
      await store.record(resource, 'user');
      await store.record(resource, 'background');

      const status = await store.getStatus(resource);
      const expectedRemaining =
        status.adaptive!.userReserved -
        2 +
        (status.adaptive!.backgroundMax - 1);

      expect(status.remaining).toBe(expectedRemaining);
    });
  });

  describe('getWaitTime', () => {
    it('should return 0 when request can proceed', async () => {
      const waitTime = await store.getWaitTime(resource, 'user');
      expect(waitTime).toBe(0);
    });

    it('should return wait time when background is paused', async () => {
      // Create high activity to pause background
      for (let i = 0; i < 15; i++) {
        await store.record(resource, 'user');
      }

      vi.advanceTimersByTime(35 * 1000); // Force recalculation

      const waitTime = await store.getWaitTime(resource, 'background');
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(30000); // Should be within recalc interval
    });

    it('should return time until requests age out when capacity exceeded', async () => {
      // Fill up user capacity (need 185 to exceed high activity allocation)
      for (let i = 0; i < 185; i++) {
        await store.record(resource, 'user');
      }

      const waitTime = await store.getWaitTime(resource, 'user');
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(15 * 60 * 1000); // Should be within monitoring window
    });
  });

  describe('reset', () => {
    it('should clear all data for a resource', async () => {
      await store.record(resource, 'user');
      await store.record(resource, 'background');

      let status = await store.getStatus(resource);
      expect(status.adaptive?.recentUserActivity).toBe(1);

      await store.reset(resource);

      status = await store.getStatus(resource);
      expect(status.adaptive?.recentUserActivity).toBe(0);
    });
  });

  describe('capacity caching', () => {
    it('should cache capacity calculations to avoid thrashing', async () => {
      await store.record(resource, 'user');

      const status1 = await store.getStatus(resource);
      const status2 = await store.getStatus(resource);

      // Should return same cached result
      expect(status1.adaptive?.reason).toBe(status2.adaptive?.reason);
      expect(status1.adaptive?.userReserved).toBe(
        status2.adaptive?.userReserved,
      );
    });

    it('should recalculate after recalculation interval', async () => {
      await store.record(resource, 'user');
      const status1 = await store.getStatus(resource);

      // Add more activity
      for (let i = 0; i < 10; i++) {
        await store.record(resource, 'user');
      }

      // Should still return cached result
      const status2 = await store.getStatus(resource);
      expect(status2.adaptive?.reason).toBe(status1.adaptive?.reason);

      // Advance past recalculation interval
      vi.advanceTimersByTime(35 * 1000);

      // Should now recalculate and return different result
      const status3 = await store.getStatus(resource);
      expect(status3.adaptive?.reason).not.toBe(status1.adaptive?.reason);
      expect(status3.adaptive?.recentUserActivity).toBeGreaterThan(
        status1.adaptive?.recentUserActivity,
      );
    });
  });

  describe('cleanup', () => {
    it('should clean up old requests outside monitoring window', async () => {
      // Record request at current time
      await store.record(resource, 'user');

      // Advance time beyond monitoring window (15 minutes default)
      vi.advanceTimersByTime(20 * 60 * 1000);

      // Record another request to trigger cleanup
      await store.record(resource, 'user');

      const status = await store.getStatus(resource);

      // Should only count the recent request, old one should be cleaned up
      expect(status.adaptive?.recentUserActivity).toBe(1);
    });
  });

  describe('multiple resources', () => {
    it('should handle multiple resources independently', async () => {
      const resource1 = 'resource1';
      const resource2 = 'resource2';

      await store.record(resource1, 'user');
      await store.record(resource2, 'background');

      const status1 = await store.getStatus(resource1);
      const status2 = await store.getStatus(resource2);

      expect(status1.adaptive?.recentUserActivity).toBe(1);
      expect(status2.adaptive?.recentUserActivity).toBe(0);
    });
  });
});
