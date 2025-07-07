import type { RateLimitConfig, RateLimitStore } from '@comic-vine/client';

interface RateLimitInfo {
  requests: Array<number>;
  limit: number;
  windowMs: number;
  resetTime: number;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private limits = new Map<string, RateLimitInfo>();
  private defaultConfig: RateLimitConfig;
  private resourceConfigs = new Map<string, RateLimitConfig>();
  private cleanupInterval?: NodeJS.Timeout;
  private totalRequests: number = 0;

  constructor(
    defaultConfig: RateLimitConfig = { limit: 100, windowMs: 60000 }, // 100 requests per minute
    resourceConfigs: Map<string, RateLimitConfig> = new Map(),
    options: { cleanupIntervalMs?: number } = {},
  ) {
    this.defaultConfig = defaultConfig;
    this.resourceConfigs = resourceConfigs;

    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute default
    if (cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);
    }
  }

  async canProceed(resource: string): Promise<boolean> {
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const info = this.getOrCreateRateLimitInfo(resource, config);

    this.cleanupExpiredRequests(info);

    return info.requests.length < info.limit;
  }

  async record(resource: string): Promise<void> {
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const info = this.getOrCreateRateLimitInfo(resource, config);

    this.cleanupExpiredRequests(info);

    const now = Date.now();
    info.requests.push(now);
    this.totalRequests++;

    // Update reset time to be one window from now
    info.resetTime = now + config.windowMs;
  }

  async getStatus(resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
  }> {
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const info = this.getOrCreateRateLimitInfo(resource, config);

    this.cleanupExpiredRequests(info);

    return {
      remaining: Math.max(0, info.limit - info.requests.length),
      resetTime: new Date(info.resetTime),
      limit: info.limit,
    };
  }

  async reset(resource: string): Promise<void> {
    const info = this.limits.get(resource);
    if (info) {
      // Subtract the requests for this resource from total count
      this.totalRequests = Math.max(
        0,
        this.totalRequests - info.requests.length,
      );
    }
    this.limits.delete(resource);
  }

  async getWaitTime(resource: string): Promise<number> {
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const info = this.getOrCreateRateLimitInfo(resource, config);

    this.cleanupExpiredRequests(info);

    // Special case: if limit is 0, always return the time until window resets
    if (info.limit === 0) {
      return Math.max(0, info.resetTime - Date.now());
    }

    if (info.requests.length < info.limit) {
      return 0;
    }

    // Find the oldest request that's still within the window
    const oldestRequest = info.requests[0];
    if (oldestRequest === undefined) {
      return 0;
    }
    const timeUntilOldestExpires = oldestRequest + config.windowMs - Date.now();

    return Math.max(0, timeUntilOldestExpires);
  }

  /**
   * Set rate limit configuration for a specific resource
   */
  setResourceConfig(resource: string, config: RateLimitConfig): void {
    this.resourceConfigs.set(resource, config);
    // Reset existing limits for this resource to apply new config
    this.limits.delete(resource);
  }

  /**
   * Get rate limit configuration for a resource
   */
  getResourceConfig(resource: string): RateLimitConfig {
    return this.resourceConfigs.get(resource) || this.defaultConfig;
  }

  /**
   * Get statistics for all resources
   */
  getStats(): {
    totalResources: number;
    activeResources: number;
    rateLimitedResources: number;
    totalRequests: number;
  } {
    let activeResources = 0;
    let rateLimitedResources = 0;

    for (const [_resource, info] of this.limits) {
      this.cleanupExpiredRequests(info);

      if (info.requests.length > 0) {
        activeResources++;
        if (info.requests.length >= info.limit) {
          rateLimitedResources++;
        }
      }
    }

    return {
      totalResources: this.limits.size,
      activeResources,
      rateLimitedResources,
      totalRequests: this.totalRequests,
    };
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.limits.clear();
    this.totalRequests = 0;
  }

  /**
   * Clean up expired requests for all resources
   */
  cleanup(): void {
    for (const [_resource, info] of this.limits) {
      this.cleanupExpiredRequests(info);
    }
  }

  /**
   * Destroy the store and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }

  private getOrCreateRateLimitInfo(
    resource: string,
    config: RateLimitConfig,
  ): RateLimitInfo {
    let info = this.limits.get(resource);
    if (!info) {
      info = {
        requests: [],
        limit: config.limit,
        windowMs: config.windowMs,
        resetTime: Date.now() + config.windowMs,
      };
      this.limits.set(resource, info);
    }
    return info;
  }

  private cleanupExpiredRequests(info: RateLimitInfo): void {
    const now = Date.now();
    const cutoff = now - info.windowMs;
    const initialLength = info.requests.length;

    // Remove requests older than the window
    while (info.requests.length > 0 && info.requests[0]! < cutoff) {
      info.requests.shift();
    }

    // Update total request count to reflect removed expired requests
    const expiredCount = initialLength - info.requests.length;
    this.totalRequests = Math.max(0, this.totalRequests - expiredCount);

    // Update reset time if no requests remain
    if (info.requests.length === 0) {
      info.resetTime = now + info.windowMs;
    }
  }
}
