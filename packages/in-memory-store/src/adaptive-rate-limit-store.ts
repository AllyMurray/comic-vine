import {
  AdaptiveConfigSchema,
  type AdaptiveRateLimitStore as IAdaptiveRateLimitStore,
  type RequestPriority,
  AdaptiveCapacityCalculator,
  type ActivityMetrics,
  type DynamicCapacityResult,
} from '@comic-vine/client';
import { z } from 'zod';

export interface AdaptiveRateLimitStoreOptions {
  adaptiveConfig?: Partial<z.input<typeof AdaptiveConfigSchema>>;
}

/**
 * In-memory rate limiting store with adaptive priority-based capacity allocation
 */
export class AdaptiveRateLimitStore implements IAdaptiveRateLimitStore {
  private activityMetrics = new Map<string, ActivityMetrics>();
  private capacityCalculator: AdaptiveCapacityCalculator;
  private lastCapacityUpdate = new Map<string, number>();
  private cachedCapacity = new Map<string, DynamicCapacityResult>();

  constructor(options: AdaptiveRateLimitStoreOptions = {}) {
    this.capacityCalculator = new AdaptiveCapacityCalculator(
      options.adaptiveConfig,
    );
  }

  async canProceed(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<boolean> {
    const metrics = this.getOrCreateActivityMetrics(resource);
    const capacity = this.calculateCurrentCapacity(resource, metrics);

    // Check if background requests should be paused
    if (priority === 'background' && capacity.backgroundPaused) {
      return false; // Hard pause for background requests
    }

    // Get current usage
    const currentUserRequests = this.getCurrentUsage(
      metrics.recentUserRequests,
    );
    const currentBackgroundRequests = this.getCurrentUsage(
      metrics.recentBackgroundRequests,
    );

    if (priority === 'user') {
      return currentUserRequests < capacity.userReserved;
    } else {
      return currentBackgroundRequests < capacity.backgroundMax;
    }
  }

  async record(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<void> {
    const metrics = this.getOrCreateActivityMetrics(resource);
    const now = Date.now();

    if (priority === 'user') {
      metrics.recentUserRequests.push(now);
      this.cleanupOldRequests(metrics.recentUserRequests);
    } else {
      metrics.recentBackgroundRequests.push(now);
      this.cleanupOldRequests(metrics.recentBackgroundRequests);
    }

    // Update activity trend
    metrics.userActivityTrend = this.capacityCalculator.calculateActivityTrend(
      metrics.recentUserRequests,
    );
  }

  async getStatus(resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
    adaptive?: {
      userReserved: number;
      backgroundMax: number;
      backgroundPaused: boolean;
      recentUserActivity: number;
      reason: string;
    };
  }> {
    const metrics = this.getOrCreateActivityMetrics(resource);
    const capacity = this.calculateCurrentCapacity(resource, metrics);
    const currentUserUsage = this.getCurrentUsage(metrics.recentUserRequests);
    const currentBackgroundUsage = this.getCurrentUsage(
      metrics.recentBackgroundRequests,
    );

    return {
      remaining:
        capacity.userReserved -
        currentUserUsage +
        (capacity.backgroundMax - currentBackgroundUsage),
      resetTime: new Date(
        Date.now() + this.capacityCalculator.config.monitoringWindowMs,
      ),
      limit: this.getResourceLimit(resource),
      adaptive: {
        userReserved: capacity.userReserved,
        backgroundMax: capacity.backgroundMax,
        backgroundPaused: capacity.backgroundPaused,
        recentUserActivity: this.capacityCalculator.getRecentActivity(
          metrics.recentUserRequests,
        ),
        reason: capacity.reason,
      },
    };
  }

  async reset(resource: string): Promise<void> {
    this.activityMetrics.delete(resource);
    this.cachedCapacity.delete(resource);
    this.lastCapacityUpdate.delete(resource);
  }

  async getWaitTime(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<number> {
    const canProceed = await this.canProceed(resource, priority);
    if (canProceed) {
      return 0;
    }

    const metrics = this.getOrCreateActivityMetrics(resource);
    const capacity = this.calculateCurrentCapacity(resource, metrics);

    // If background is paused, wait until next recalculation
    if (priority === 'background' && capacity.backgroundPaused) {
      const lastUpdate = this.lastCapacityUpdate.get(resource) || 0;
      const nextUpdate =
        lastUpdate + this.capacityCalculator.config.recalculationIntervalMs;
      return Math.max(0, nextUpdate - Date.now());
    }

    // Otherwise, wait until requests age out of the monitoring window
    const monitoringWindow = this.capacityCalculator.config.monitoringWindowMs;
    const requests =
      priority === 'user'
        ? metrics.recentUserRequests
        : metrics.recentBackgroundRequests;

    if (requests.length === 0) {
      return 0;
    }

    // Wait until the oldest request falls out of the monitoring window
    const oldestRequest = Math.min(...requests);
    const waitTime = oldestRequest + monitoringWindow - Date.now();
    return Math.max(0, waitTime);
  }

  private calculateCurrentCapacity(
    resource: string,
    metrics: ActivityMetrics,
  ): DynamicCapacityResult {
    // Only recalculate based on configured interval to avoid thrashing
    const lastUpdate = this.lastCapacityUpdate.get(resource) || 0;
    const recalcInterval =
      this.capacityCalculator.config.recalculationIntervalMs;

    if (Date.now() - lastUpdate < recalcInterval) {
      return (
        this.cachedCapacity.get(resource) || this.getDefaultCapacity(resource)
      );
    }

    const totalLimit = this.getResourceLimit(resource);
    const capacity = this.capacityCalculator.calculateDynamicCapacity(
      resource,
      totalLimit,
      metrics,
    );

    this.cachedCapacity.set(resource, capacity);
    this.lastCapacityUpdate.set(resource, Date.now());

    return capacity;
  }

  private getOrCreateActivityMetrics(resource: string): ActivityMetrics {
    if (!this.activityMetrics.has(resource)) {
      this.activityMetrics.set(resource, {
        recentUserRequests: [],
        recentBackgroundRequests: [],
        userActivityTrend: 'none',
      });
    }
    return this.activityMetrics.get(resource)!;
  }

  private getCurrentUsage(requests: Array<number>): number {
    const cutoff =
      Date.now() - this.capacityCalculator.config.monitoringWindowMs;
    return requests.filter((timestamp) => timestamp > cutoff).length;
  }

  private cleanupOldRequests(requests: Array<number>): void {
    const cutoff =
      Date.now() - this.capacityCalculator.config.monitoringWindowMs;
    while (requests.length > 0 && requests[0]! < cutoff) {
      requests.shift();
    }
  }

  private getResourceLimit(_resource: string): number {
    // Default Comic Vine API limits - 200 requests per hour for most resources
    return 200;
  }

  private getDefaultCapacity(resource: string): DynamicCapacityResult {
    const totalLimit = this.getResourceLimit(resource);
    return {
      userReserved: Math.floor(totalLimit * 0.3),
      backgroundMax: Math.floor(totalLimit * 0.7),
      backgroundPaused: false,
      reason: 'Default capacity allocation',
    };
  }
}
