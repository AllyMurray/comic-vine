import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AdaptiveCapacityCalculator,
  type ActivityMetrics,
} from './adaptive-capacity-calculator.js';

describe('AdaptiveCapacityCalculator', () => {
  let calculator: AdaptiveCapacityCalculator;
  const totalLimit = 200;
  const resource = 'test-resource';

  beforeEach(() => {
    calculator = new AdaptiveCapacityCalculator();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default configuration when no config provided', () => {
      expect(calculator.config.monitoringWindowMs).toBe(15 * 60 * 1000);
      expect(calculator.config.highActivityThreshold).toBe(10);
      expect(calculator.config.moderateActivityThreshold).toBe(3);
      expect(calculator.config.recalculationIntervalMs).toBe(30000);
      expect(calculator.config.sustainedInactivityThresholdMs).toBe(
        30 * 60 * 1000,
      );
      expect(calculator.config.backgroundPauseOnIncreasingTrend).toBe(true);
      expect(calculator.config.maxUserScaling).toBe(2.0);
      expect(calculator.config.minUserReserved).toBe(5);
    });

    it('should override defaults with provided config', () => {
      const customCalculator = new AdaptiveCapacityCalculator({
        highActivityThreshold: 15,
        maxUserScaling: 3.0,
      });

      expect(customCalculator.config.highActivityThreshold).toBe(15);
      expect(customCalculator.config.maxUserScaling).toBe(3.0);
      expect(customCalculator.config.moderateActivityThreshold).toBe(3); // default
    });

    it('should validate configuration and throw error for invalid values', () => {
      expect(
        () =>
          new AdaptiveCapacityCalculator({
            monitoringWindowMs: -1000,
          }),
      ).toThrow();

      expect(
        () =>
          new AdaptiveCapacityCalculator({
            moderateActivityThreshold: 15,
            highActivityThreshold: 10, // moderate >= high should fail
          }),
      ).toThrow(
        'moderateActivityThreshold must be less than highActivityThreshold',
      );
    });
  });

  describe('getRecentActivity', () => {
    it('should count requests within monitoring window', () => {
      const now = Date.now();
      const requests = [
        now - 5 * 60 * 1000, // 5 minutes ago (within 15min window)
        now - 10 * 60 * 1000, // 10 minutes ago (within 15min window)
        now - 20 * 60 * 1000, // 20 minutes ago (outside 15min window)
      ];

      const count = calculator.getRecentActivity(requests);
      expect(count).toBe(2); // Only first two should count
    });

    it('should return 0 for empty requests array', () => {
      const count = calculator.getRecentActivity([]);
      expect(count).toBe(0);
    });

    it('should return 0 when all requests are outside window', () => {
      const now = Date.now();
      const requests = [
        now - 20 * 60 * 1000, // 20 minutes ago
        now - 30 * 60 * 1000, // 30 minutes ago
      ];

      const count = calculator.getRecentActivity(requests);
      expect(count).toBe(0);
    });
  });

  describe('calculateActivityTrend', () => {
    it('should detect increasing trend', () => {
      const now = Date.now();

      const requests = [
        // Recent window (0-5 min ago): 6 requests
        now - 1 * 60 * 1000,
        now - 2 * 60 * 1000,
        now - 3 * 60 * 1000,
        now - 4 * 60 * 1000,
        now - 4.5 * 60 * 1000,
        now - 5 * 60 * 1000,
        // Previous window (5-10 min ago): 2 requests
        now - 6 * 60 * 1000,
        now - 7 * 60 * 1000,
      ];

      const trend = calculator.calculateActivityTrend(requests);
      expect(trend).toBe('increasing'); // 6 > 2 * 1.5
    });

    it('should detect decreasing trend', () => {
      const now = Date.now();

      const requests = [
        // Recent window: 1 request
        now - 1 * 60 * 1000,
        // Previous window: 4 requests
        now - 6 * 60 * 1000,
        now - 7 * 60 * 1000,
        now - 8 * 60 * 1000,
        now - 9 * 60 * 1000,
      ];

      const trend = calculator.calculateActivityTrend(requests);
      expect(trend).toBe('decreasing'); // 1 < 4 * 0.5
    });

    it('should detect stable trend', () => {
      const now = Date.now();

      const requests = [
        // Recent window: 3 requests
        now - 1 * 60 * 1000,
        now - 2 * 60 * 1000,
        now - 3 * 60 * 1000,
        // Previous window: 3 requests
        now - 6 * 60 * 1000,
        now - 7 * 60 * 1000,
        now - 8 * 60 * 1000,
      ];

      const trend = calculator.calculateActivityTrend(requests);
      expect(trend).toBe('stable'); // 3 is between 3*0.5 and 3*1.5
    });

    it('should return none when no activity in either window', () => {
      const trend = calculator.calculateActivityTrend([]);
      expect(trend).toBe('none');
    });
  });

  describe('calculateDynamicCapacity - Strategy 1: High Activity', () => {
    it('should pause background when high activity and increasing trend', () => {
      const now = Date.now();
      const windowSize = (15 * 60 * 1000) / 3; // 5 minutes

      // Create increasing trend: 8 requests in recent window (0-5min ago), 2 in previous window (5-10min ago)
      const recentRequests = Array(8)
        .fill(0)
        .map((_, i) => now - i * 30 * 1000); // 8 requests in last 5 min
      const previousRequests = Array(2)
        .fill(0)
        .map((_, i) => now - windowSize - i * 30 * 1000); // 2 requests 5-10 min ago

      const metrics: ActivityMetrics = {
        recentUserRequests: [...recentRequests, ...previousRequests], // Total: 10 requests (> threshold)
        recentBackgroundRequests: [],
        userActivityTrend: 'increasing', // This will be recalculated anyway
      };

      const result = calculator.calculateDynamicCapacity(
        resource,
        totalLimit,
        metrics,
      );

      expect(result.backgroundPaused).toBe(true);
      expect(result.userReserved).toBe(Math.min(180, 100 * 2.0)); // min(90% of 200, 50% * 2.0 scaling)
      expect(result.reason).toContain('High user activity');
    });

    it('should not pause background when high activity but stable trend and backgroundPauseOnIncreasingTrend is false', () => {
      const customCalculator = new AdaptiveCapacityCalculator({
        backgroundPauseOnIncreasingTrend: false,
      });

      const metrics: ActivityMetrics = {
        recentUserRequests: Array(12)
          .fill(0)
          .map((_, i) => Date.now() - i * 60 * 1000),
        recentBackgroundRequests: [],
        userActivityTrend: 'increasing',
      };

      const result = customCalculator.calculateDynamicCapacity(
        resource,
        totalLimit,
        metrics,
      );

      expect(result.backgroundPaused).toBe(false);
    });
  });

  describe('calculateDynamicCapacity - Strategy 2: Moderate Activity', () => {
    it('should provide balanced scaling for moderate activity', () => {
      const metrics: ActivityMetrics = {
        recentUserRequests: Array(5)
          .fill(0)
          .map((_, i) => Date.now() - i * 60 * 1000), // 5 requests
        recentBackgroundRequests: [],
        userActivityTrend: 'stable',
      };

      const result = calculator.calculateDynamicCapacity(
        resource,
        totalLimit,
        metrics,
      );

      expect(result.backgroundPaused).toBe(false);
      expect(result.userReserved).toBeGreaterThan(Math.floor(totalLimit * 0.4)); // More than base 40%
      expect(result.userReserved).toBeLessThanOrEqual(totalLimit * 0.7); // But not more than 70%
      expect(result.reason).toContain('Moderate user activity');
    });

    it('should scale up more aggressively for increasing trend', () => {
      const now = Date.now();
      const windowSize = (15 * 60 * 1000) / 3; // 5 minutes

      // Stable trend: 2 requests recent, 2 requests previous (2 == 2 * 1.0)
      const stableRequests = [
        now - 60 * 1000,
        now - 120 * 1000, // 2 in recent window
        now - windowSize - 60 * 1000,
        now - windowSize - 120 * 1000, // 2 in previous window
      ];

      // Increasing trend: 4 requests recent, 2 requests previous (4 > 2 * 1.5)
      const increasingRequests = [
        now - 60 * 1000,
        now - 120 * 1000,
        now - 180 * 1000,
        now - 240 * 1000, // 4 in recent window
        now - windowSize - 60 * 1000,
        now - windowSize - 120 * 1000, // 2 in previous window
      ];

      const stableResult = calculator.calculateDynamicCapacity(
        resource,
        totalLimit,
        {
          recentUserRequests: stableRequests,
          recentBackgroundRequests: [],
          userActivityTrend: 'stable', // Will be recalculated
        },
      );

      const increasingResult = calculator.calculateDynamicCapacity(
        resource,
        totalLimit,
        {
          recentUserRequests: increasingRequests,
          recentBackgroundRequests: [],
          userActivityTrend: 'increasing', // Will be recalculated
        },
      );

      expect(increasingResult.userReserved).toBeGreaterThan(
        stableResult.userReserved,
      );
    });
  });

  describe('calculateDynamicCapacity - Strategy 3: Zero Activity', () => {
    it('should give full capacity to background after sustained inactivity', () => {
      const now = Date.now();
      const sustainedThreshold = 30 * 60 * 1000; // 30 minutes

      // Create metrics with old requests to simulate sustained inactivity
      const metrics: ActivityMetrics = {
        recentUserRequests: [now - sustainedThreshold - 60 * 1000], // Request from 31 minutes ago
        recentBackgroundRequests: [],
        userActivityTrend: 'none',
      };

      const result = calculator.calculateDynamicCapacity(
        resource,
        totalLimit,
        metrics,
      );

      expect(result.userReserved).toBe(0);
      expect(result.backgroundMax).toBe(totalLimit);
      expect(result.backgroundPaused).toBe(false);
      expect(result.reason).toContain('full capacity to background');
    });

    it('should provide minimal user buffer for recent zero activity', () => {
      const now = Date.now();
      const metrics: ActivityMetrics = {
        recentUserRequests: [now - 10 * 60 * 1000], // 10 minutes ago (recent but not current)
        recentBackgroundRequests: [],
        userActivityTrend: 'none',
      };

      vi.spyOn(calculator, 'getRecentActivity').mockReturnValue(0);

      const result = calculator.calculateDynamicCapacity(
        resource,
        totalLimit,
        metrics,
      );

      expect(result.userReserved).toBe(calculator.config.minUserReserved);
      expect(result.backgroundMax).toBe(
        totalLimit - calculator.config.minUserReserved,
      );
      expect(result.reason).toContain('minimal user buffer');
    });
  });

  describe('calculateDynamicCapacity - Strategy 4: Very Low Activity', () => {
    it('should provide gradual background scale up for very low activity', () => {
      const metrics: ActivityMetrics = {
        recentUserRequests: [Date.now() - 5 * 60 * 1000], // 1 request
        recentBackgroundRequests: [],
        userActivityTrend: 'stable',
      };

      const result = calculator.calculateDynamicCapacity(
        resource,
        totalLimit,
        metrics,
      );

      expect(result.userReserved).toBe(
        Math.max(
          Math.floor(totalLimit * 0.3),
          calculator.config.minUserReserved,
        ),
      ); // 30% base or minimum reserved
      expect(result.backgroundPaused).toBe(false);
      expect(result.reason).toContain('Low user activity');
    });

    it('should respect minimum user reserved even when 30% is smaller', () => {
      const smallLimit = 10; // 30% would be 3, but minUserReserved is 5
      const metrics: ActivityMetrics = {
        recentUserRequests: [Date.now() - 5 * 60 * 1000],
        recentBackgroundRequests: [],
        userActivityTrend: 'stable',
      };

      const result = calculator.calculateDynamicCapacity(
        resource,
        smallLimit,
        metrics,
      );

      expect(result.userReserved).toBe(calculator.config.minUserReserved); // 5, not 3
    });
  });

  describe('edge cases', () => {
    it('should handle empty activity metrics gracefully', () => {
      const metrics: ActivityMetrics = {
        recentUserRequests: [],
        recentBackgroundRequests: [],
        userActivityTrend: 'none',
      };

      const result = calculator.calculateDynamicCapacity(
        resource,
        totalLimit,
        metrics,
      );

      expect(result).toBeDefined();
      expect(result.userReserved).toBeGreaterThanOrEqual(0);
      expect(result.backgroundMax).toBeGreaterThanOrEqual(0);
      expect(result.userReserved + result.backgroundMax).toBeLessThanOrEqual(
        totalLimit,
      );
    });

    it('should handle very small total limits', () => {
      const smallLimit = 5;
      const metrics: ActivityMetrics = {
        recentUserRequests: Array(15)
          .fill(0)
          .map((_, i) => Date.now() - i * 60 * 1000), // High activity
        recentBackgroundRequests: [],
        userActivityTrend: 'increasing',
      };

      const result = calculator.calculateDynamicCapacity(
        resource,
        smallLimit,
        metrics,
      );

      expect(result.userReserved).toBeGreaterThan(0);
      expect(result.backgroundMax).toBeGreaterThanOrEqual(0);
      expect(result.userReserved + result.backgroundMax).toBeLessThanOrEqual(
        smallLimit,
      );
    });

    it('should handle very large total limits', () => {
      const largeLimit = 10000;
      const metrics: ActivityMetrics = {
        recentUserRequests: Array(12)
          .fill(0)
          .map((_, i) => Date.now() - i * 60 * 1000),
        recentBackgroundRequests: [],
        userActivityTrend: 'increasing',
      };

      const result = calculator.calculateDynamicCapacity(
        resource,
        largeLimit,
        metrics,
      );

      expect(result.userReserved).toBeGreaterThan(0);
      expect(result.backgroundMax).toBeGreaterThan(0);
      expect(result.userReserved).toBeLessThanOrEqual(largeLimit);
    });
  });
});
