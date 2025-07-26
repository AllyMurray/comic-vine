import { z } from 'zod';
import { AdaptiveConfigSchema } from './rate-limit-store.js';

interface ActivityMetrics {
  recentUserRequests: Array<number>;
  recentBackgroundRequests: Array<number>;
  userActivityTrend: 'increasing' | 'stable' | 'decreasing' | 'none';
}

interface DynamicCapacityResult {
  userReserved: number;
  backgroundMax: number;
  backgroundPaused: boolean;
  reason: string;
}

/**
 * Calculates dynamic capacity allocation based on real-time user activity patterns
 */
export class AdaptiveCapacityCalculator {
  public readonly config: z.infer<typeof AdaptiveConfigSchema>;

  constructor(config: Partial<z.input<typeof AdaptiveConfigSchema>> = {}) {
    // Zod handles validation and applies defaults automatically
    this.config = AdaptiveConfigSchema.parse(config);
  }

  calculateDynamicCapacity(
    resource: string,
    totalLimit: number,
    activityMetrics: ActivityMetrics,
  ): DynamicCapacityResult {
    const recentUserActivity = this.getRecentActivity(
      activityMetrics.recentUserRequests,
    );
    const activityTrend = this.calculateActivityTrend(
      activityMetrics.recentUserRequests,
    );

    // Strategy 1: High Activity - Pause Background
    if (recentUserActivity >= this.config.highActivityThreshold) {
      const userCapacity = Math.min(
        totalLimit * 0.9,
        Math.floor(totalLimit * 0.5 * this.config.maxUserScaling), // 50% base * scaling factor
      );

      return {
        userReserved: userCapacity,
        backgroundMax: totalLimit - userCapacity,
        backgroundPaused:
          this.config.backgroundPauseOnIncreasingTrend &&
          activityTrend === 'increasing',
        reason: `High user activity (${recentUserActivity} requests/${this.config.monitoringWindowMs / 60000}min) - prioritizing users`,
      };
    }

    // Strategy 2: Moderate Activity - Balanced Scaling
    if (recentUserActivity >= this.config.moderateActivityThreshold) {
      const userMultiplier = this.getUserMultiplier(
        recentUserActivity,
        activityTrend,
      );
      const baseUserCapacity = Math.floor(totalLimit * 0.4); // 40% base allocation
      const dynamicUserCapacity = Math.min(
        totalLimit * 0.7,
        baseUserCapacity * userMultiplier,
      );

      return {
        userReserved: dynamicUserCapacity,
        backgroundMax: totalLimit - dynamicUserCapacity,
        backgroundPaused: false,
        reason: `Moderate user activity - dynamic scaling (${userMultiplier.toFixed(1)}x user capacity)`,
      };
    }

    // Strategy 3: Low/No Activity - Background Scale Up
    if (recentUserActivity === 0) {
      const sustainedInactivity = this.getSustainedInactivityPeriod(
        activityMetrics.recentUserRequests,
      );

      if (sustainedInactivity > this.config.sustainedInactivityThresholdMs) {
        return {
          userReserved: 0, // No reservation - background gets everything!
          backgroundMax: totalLimit, // Full capacity available
          backgroundPaused: false,
          reason: `Sustained zero activity (${Math.floor(sustainedInactivity / 60000)}+ min) - full capacity to background`,
        };
      } else {
        return {
          userReserved: this.config.minUserReserved, // Minimal safety buffer
          backgroundMax: totalLimit - this.config.minUserReserved,
          backgroundPaused: false,
          reason:
            'Recent zero activity - background scale up with minimal user buffer',
        };
      }
    }

    // Strategy 4: Very Low Activity - Gradual Background Scale Up
    const baseUserCapacity = Math.floor(totalLimit * 0.3); // 30% base for very low activity
    return {
      userReserved: Math.max(baseUserCapacity, this.config.minUserReserved),
      backgroundMax:
        totalLimit - Math.max(baseUserCapacity, this.config.minUserReserved),
      backgroundPaused: false,
      reason: `Low user activity (${recentUserActivity} requests/${this.config.monitoringWindowMs / 60000}min) - background scale up`,
    };
  }

  getRecentActivity(requests: Array<number>): number {
    const cutoff = Date.now() - this.config.monitoringWindowMs;
    return requests.filter((timestamp) => timestamp > cutoff).length;
  }

  calculateActivityTrend(
    requests: Array<number>,
  ): 'increasing' | 'stable' | 'decreasing' | 'none' {
    const now = Date.now();
    const windowSize = this.config.monitoringWindowMs / 3; // Use 1/3 of monitoring window for trend
    const recent = requests.filter((t) => t > now - windowSize).length;
    const previous = requests.filter(
      (t) => t > now - 2 * windowSize && t <= now - windowSize,
    ).length;

    if (recent === 0 && previous === 0) return 'none';
    if (recent > previous * 1.5) return 'increasing';
    if (recent < previous * 0.5) return 'decreasing';
    return 'stable';
  }

  private getUserMultiplier(activity: number, trend: string): number {
    let base = Math.min(
      this.config.maxUserScaling,
      1 + activity / this.config.highActivityThreshold,
    );

    // Adjust based on trend
    if (trend === 'increasing') base *= 1.2;
    if (trend === 'decreasing') base *= 0.8;

    return Math.max(1.0, base);
  }

  private getSustainedInactivityPeriod(requests: Array<number>): number {
    if (requests.length === 0) {
      return 0; // No requests ever = no sustained inactivity period yet
    }

    const lastRequest = Math.max(...requests);
    return Date.now() - lastRequest;
  }
}

// Export types for use in other modules
export type { ActivityMetrics, DynamicCapacityResult };
