import {
  AdaptiveCapacityCalculator,
  type AdaptiveRateLimitStore as IAdaptiveRateLimitStore,
  type RequestPriority,
  type AdaptiveConfigSchema,
  type RateLimitConfig,
  type ActivityMetrics,
  type DynamicCapacityResult,
} from '@comic-vine/client';
import Database from 'better-sqlite3';
import { and, eq, count, sql, lt } from 'drizzle-orm';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { z } from 'zod';
import { rateLimitTable } from './schema.js';

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  limit: 200,
  windowMs: 3600000, // 1 hour
};

export interface SqliteAdaptiveRateLimitStoreOptions {
  /** File path or existing `better-sqlite3` Database instance. Defaults to `':memory:'`. */
  database?: string | InstanceType<typeof Database>;
  /** Global/default rate-limit config applied when a resource-specific override is not provided. */
  defaultConfig?: RateLimitConfig;
  /** Optional per-resource overrides. */
  resourceConfigs?: Map<string, RateLimitConfig>;
  /** Adaptive configuration for priority-based rate limiting */
  adaptiveConfig?: Partial<z.input<typeof AdaptiveConfigSchema>>;
}

export class SqliteAdaptiveRateLimitStore implements IAdaptiveRateLimitStore {
  private db: BetterSQLite3Database;
  private sqlite: InstanceType<typeof Database>;
  /** Indicates whether this store manages (and should close) the SQLite connection */
  private readonly isConnectionManaged: boolean = false;
  private defaultConfig: RateLimitConfig;
  private resourceConfigs = new Map<string, RateLimitConfig>();
  private isDestroyed = false;

  // Adaptive rate limiting components
  private capacityCalculator: AdaptiveCapacityCalculator;
  private activityMetrics = new Map<string, ActivityMetrics>();
  private lastCapacityUpdate = new Map<string, number>();
  private cachedCapacity = new Map<string, DynamicCapacityResult>();

  constructor({
    database = ':memory:',
    defaultConfig = DEFAULT_RATE_LIMIT,
    resourceConfigs = new Map<string, RateLimitConfig>(),
    adaptiveConfig = {},
  }: SqliteAdaptiveRateLimitStoreOptions = {}) {
    // Allow callers to pass a pre-existing connection so that all stores can
    // operate on the same underlying DB file.
    let sqliteInstance: InstanceType<typeof Database>;
    let isConnectionManaged = false;

    if (typeof database === 'string') {
      sqliteInstance = new Database(database);
      isConnectionManaged = true;
    } else {
      sqliteInstance = database;
    }

    this.sqlite = sqliteInstance;
    this.isConnectionManaged = isConnectionManaged;
    this.db = drizzle(sqliteInstance);
    this.defaultConfig = defaultConfig;
    this.resourceConfigs = resourceConfigs;

    // Initialize adaptive components
    this.capacityCalculator = new AdaptiveCapacityCalculator(adaptiveConfig);

    this.initializeDatabase();
  }

  async canProceed(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<boolean> {
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    // Load activity metrics if needed
    await this.ensureActivityMetrics(resource);
    const metrics = this.getOrCreateActivityMetrics(resource);
    const capacity = this.calculateCurrentCapacity(resource, metrics);

    // Check if background requests should be paused
    if (priority === 'background' && capacity.backgroundPaused) {
      return false; // Hard pause for background requests
    }

    // Get current usage for each priority
    const currentUserRequests = await this.getCurrentUsage(resource, 'user');
    const currentBackgroundRequests = await this.getCurrentUsage(
      resource,
      'background',
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
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    const now = Date.now();

    // Insert into database with priority using raw SQL to handle the additional column
    this.db.run(sql`
      INSERT INTO rate_limits (resource, timestamp, priority)
      VALUES (${resource}, ${now}, ${priority})
    `);

    // Update in-memory activity metrics
    const metrics = this.getOrCreateActivityMetrics(resource);

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
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    await this.ensureActivityMetrics(resource);
    const metrics = this.getOrCreateActivityMetrics(resource);
    const capacity = this.calculateCurrentCapacity(resource, metrics);

    const currentUserUsage = await this.getCurrentUsage(resource, 'user');
    const currentBackgroundUsage = await this.getCurrentUsage(
      resource,
      'background',
    );

    const config = this.resourceConfigs.get(resource) || this.defaultConfig;

    return {
      remaining:
        capacity.userReserved -
        currentUserUsage +
        (capacity.backgroundMax - currentBackgroundUsage),
      resetTime: new Date(Date.now() + config.windowMs),
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
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    // Clear database records
    await this.db
      .delete(rateLimitTable)
      .where(eq(rateLimitTable.resource, resource));

    // Clear in-memory metrics
    this.activityMetrics.delete(resource);
    this.cachedCapacity.delete(resource);
    this.lastCapacityUpdate.delete(resource);
  }

  async getWaitTime(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<number> {
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    const config = this.resourceConfigs.get(resource) || this.defaultConfig;

    if (config.limit === 0) {
      return config.windowMs;
    }

    const canProceed = await this.canProceed(resource, priority);
    if (canProceed) {
      return 0;
    }

    // For background requests that are paused, check back in 30 seconds
    await this.ensureActivityMetrics(resource);
    const metrics = this.getOrCreateActivityMetrics(resource);
    const capacity = this.calculateCurrentCapacity(resource, metrics);

    if (priority === 'background' && capacity.backgroundPaused) {
      return this.capacityCalculator.config.recalculationIntervalMs;
    }

    // Find the oldest request in the current window for this priority
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const oldestResult = this.sqlite
      .prepare(
        `
      SELECT timestamp
      FROM rate_limits
      WHERE resource = ? AND COALESCE(priority, 'background') = ? AND timestamp >= ?
      ORDER BY timestamp
      LIMIT 1
    `,
      )
      .get(resource, priority, windowStart) as
      | { timestamp: number }
      | undefined;

    if (!oldestResult) {
      return 0;
    }

    const oldestTimestamp = oldestResult.timestamp;
    if (!oldestTimestamp) {
      return 0;
    }

    const timeUntilOldestExpires = oldestTimestamp + config.windowMs - now;
    return Math.max(0, timeUntilOldestExpires);
  }

  /**
   * Set rate limit configuration for a specific resource
   */
  setResourceConfig(resource: string, config: RateLimitConfig): void {
    this.resourceConfigs.set(resource, config);
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
  async getStats(): Promise<{
    totalRequests: number;
    uniqueResources: number;
    rateLimitedResources: Array<string>;
  }> {
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    const totalResult = await this.db
      .select({ count: count() })
      .from(rateLimitTable);

    const resourcesResult = await this.db
      .select({ resource: rateLimitTable.resource })
      .from(rateLimitTable)
      .groupBy(rateLimitTable.resource);

    const uniqueResources = resourcesResult.length;
    const rateLimitedResources: Array<string> = [];

    for (const { resource } of resourcesResult) {
      const canProceed = await this.canProceed(resource);
      if (!canProceed) {
        rateLimitedResources.push(resource);
      }
    }

    return {
      totalRequests: (totalResult[0]?.count as number) || 0,
      uniqueResources,
      rateLimitedResources,
    };
  }

  /**
   * Clean up all rate limit data
   */
  async clear(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }
    await this.db.delete(rateLimitTable);
    this.activityMetrics.clear();
    this.cachedCapacity.clear();
    this.lastCapacityUpdate.clear();
  }

  /**
   * Clean up expired requests for all resources
   */
  async cleanup(): Promise<void> {
    const now = Date.now();

    // Find all unique resources
    const resources = await this.db
      .select({ resource: rateLimitTable.resource })
      .from(rateLimitTable)
      .groupBy(rateLimitTable.resource);

    for (const { resource } of resources) {
      const config = this.resourceConfigs.get(resource) || this.defaultConfig;
      const windowStart = now - config.windowMs;
      await this.cleanupExpiredRequests(resource, windowStart);
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    this.isDestroyed = true;

    // Close only if this instance established the connection.
    if (this.isConnectionManaged && typeof this.sqlite.close === 'function') {
      this.sqlite.close();
    }
  }

  /**
   * Alias for close() to match test expectations
   */
  destroy(): void {
    this.close();
  }

  // Private helper methods for adaptive functionality

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

  private async ensureActivityMetrics(resource: string): Promise<void> {
    if (this.activityMetrics.has(resource)) {
      return; // Already loaded
    }

    // Load recent activity from database to populate in-memory metrics
    const now = Date.now();
    const windowStart = now - this.capacityCalculator.config.monitoringWindowMs;

    const recentRequests = this.sqlite
      .prepare(
        `
      SELECT timestamp, COALESCE(priority, 'background') as priority
      FROM rate_limits
      WHERE resource = ? AND timestamp >= ?
      ORDER BY timestamp
    `,
      )
      .all(resource, windowStart) as Array<{
      timestamp: number;
      priority: string;
    }>;

    const metrics: ActivityMetrics = {
      recentUserRequests: [],
      recentBackgroundRequests: [],
      userActivityTrend: 'none',
    };

    for (const request of recentRequests) {
      if (request.priority === 'user') {
        metrics.recentUserRequests.push(request.timestamp);
      } else {
        metrics.recentBackgroundRequests.push(request.timestamp);
      }
    }

    // Calculate trend based on loaded data
    metrics.userActivityTrend = this.capacityCalculator.calculateActivityTrend(
      metrics.recentUserRequests,
    );

    this.activityMetrics.set(resource, metrics);
  }

  private async getCurrentUsage(
    resource: string,
    priority: RequestPriority,
  ): Promise<number> {
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    await this.cleanupExpiredRequests(resource, windowStart);

    // Count current requests in window for this priority using raw SQL
    const result = this.sqlite
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM rate_limits
      WHERE resource = ? AND priority = ? AND timestamp >= ?
    `,
      )
      .get(resource, priority, windowStart) as { count: number };

    return result.count || 0;
  }

  private cleanupOldRequests(requests: Array<number>): void {
    const cutoff =
      Date.now() - this.capacityCalculator.config.monitoringWindowMs;
    while (requests.length > 0 && requests[0]! < cutoff) {
      requests.shift();
    }
  }

  private getResourceLimit(resource: string): number {
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    return config.limit;
  }

  private getDefaultCapacity(resource: string): DynamicCapacityResult {
    const limit = this.getResourceLimit(resource);
    return {
      userReserved: Math.floor(limit * 0.3),
      backgroundMax: Math.floor(limit * 0.7),
      backgroundPaused: false,
      reason: 'Default capacity allocation',
    };
  }

  private async cleanupExpiredRequests(
    resource: string,
    windowStart: number,
  ): Promise<void> {
    await this.db
      .delete(rateLimitTable)
      .where(
        and(
          eq(rateLimitTable.resource, resource),
          lt(rateLimitTable.timestamp, windowStart),
        ),
      );
  }

  private initializeDatabase(): void {
    // Create tables if they don't exist
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        priority TEXT NOT NULL DEFAULT 'background'
      )
    `);

    // Check if priority column exists, add it if not (for migration from older schema)
    try {
      this.db.run(sql`
        ALTER TABLE rate_limits ADD COLUMN priority TEXT DEFAULT 'background'
      `);
    } catch {
      // Column already exists, ignore error
    }

    // Create index on resource for efficient lookups
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_resource ON rate_limits(resource)
    `);

    // Create index on timestamp for efficient cleanup
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_timestamp ON rate_limits(timestamp)
    `);

    // Create composite index for priority-based queries
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_resource_priority_timestamp
      ON rate_limits(resource, priority, timestamp)
    `);
  }
}
