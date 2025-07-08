import {
  type RateLimitConfig,
  type RateLimitStore,
  DEFAULT_RATE_LIMIT,
} from '@comic-vine/client';
import Database from 'better-sqlite3';
import { and, eq, gte, count, sql, lt } from 'drizzle-orm';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { rateLimitTable } from './schema.js';

export class SQLiteRateLimitStore implements RateLimitStore {
  private db: BetterSQLite3Database;
  private defaultConfig: RateLimitConfig;
  private resourceConfigs = new Map<string, RateLimitConfig>();
  private isDestroyed = false;

  constructor(
    databasePath: string = ':memory:',
    defaultConfig: RateLimitConfig = DEFAULT_RATE_LIMIT,
    resourceConfigs: Map<string, RateLimitConfig> = new Map(),
  ) {
    const sqlite = new Database(databasePath);
    this.db = drizzle(sqlite);
    this.defaultConfig = defaultConfig;
    this.resourceConfigs = resourceConfigs;

    this.initializeDatabase();
  }

  async canProceed(resource: string): Promise<boolean> {
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    await this.cleanupExpiredRequests(resource, windowStart);

    // Count current requests in window
    const result = await this.db
      .select({ count: count() })
      .from(rateLimitTable)
      .where(
        and(
          eq(rateLimitTable.resource, resource),
          gte(rateLimitTable.timestamp, windowStart),
        ),
      );

    const currentCount = (result[0] as { count?: number })?.count || 0;
    return currentCount < config.limit;
  }

  async record(resource: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    const now = Date.now();
    await this.db.insert(rateLimitTable).values({
      resource,
      timestamp: now,
    });
  }

  async getStatus(resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
  }> {
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    await this.cleanupExpiredRequests(resource, windowStart);

    // Count current requests in the window
    const result = await this.db
      .select({ count: count() })
      .from(rateLimitTable)
      .where(
        and(
          eq(rateLimitTable.resource, resource),
          gte(rateLimitTable.timestamp, windowStart),
        ),
      );

    const currentRequests = (result[0]?.count as number) || 0;
    const remaining = Math.max(0, config.limit - currentRequests);

    const resetTime = new Date(now + config.windowMs);

    return {
      remaining,
      resetTime,
      limit: config.limit,
    };
  }

  async reset(resource: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }
    await this.db
      .delete(rateLimitTable)
      .where(eq(rateLimitTable.resource, resource));
  }

  async getWaitTime(resource: string): Promise<number> {
    if (this.isDestroyed) {
      throw new Error('Rate limit store has been destroyed');
    }

    const config = this.resourceConfigs.get(resource) || this.defaultConfig;

    if (config.limit === 0) {
      return config.windowMs;
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    await this.cleanupExpiredRequests(resource, windowStart);

    // Count current requests in the window
    const countResult = await this.db
      .select({ count: count() })
      .from(rateLimitTable)
      .where(
        and(
          eq(rateLimitTable.resource, resource),
          gte(rateLimitTable.timestamp, windowStart),
        ),
      );

    const currentRequests = (countResult[0]?.count as number) || 0;

    if (currentRequests < config.limit) {
      return 0;
    }

    const oldestResult = await this.db
      .select({ timestamp: rateLimitTable.timestamp })
      .from(rateLimitTable)
      .where(
        and(
          eq(rateLimitTable.resource, resource),
          gte(rateLimitTable.timestamp, windowStart),
        ),
      )
      .orderBy(rateLimitTable.timestamp)
      .limit(1);

    if (oldestResult.length === 0) {
      return 0;
    }

    const oldestTimestamp = oldestResult[0]?.timestamp;
    if (oldestTimestamp === undefined) {
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

    if ('close' in this.db && typeof this.db.close === 'function') {
      this.db.close();
    }
  }

  /**
   * Alias for close() to match test expectations
   */
  destroy(): void {
    this.close();
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
        timestamp INTEGER NOT NULL
      )
    `);

    // Create index on resource for efficient lookups
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_resource ON rate_limits(resource)
    `);

    // Create index on timestamp for efficient cleanup
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_timestamp ON rate_limits(timestamp)
    `);
  }
}
