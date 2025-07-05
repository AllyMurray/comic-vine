import { RateLimitStore } from '@comic-vine/client';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, gte, lt } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { rateLimitTable } from './schema.js';

export interface RateLimitConfig {
  /** Number of requests allowed per window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export class SQLiteRateLimitStore implements RateLimitStore {
  private db: BetterSQLite3Database;
  private defaultConfig: RateLimitConfig;
  private resourceConfigs = new Map<string, RateLimitConfig>();

  constructor(
    databasePath: string = ':memory:',
    defaultConfig: RateLimitConfig = { limit: 100, windowMs: 60000 }, // 100 requests per minute
    resourceConfigs: Map<string, RateLimitConfig> = new Map(),
  ) {
    const sqlite = new Database(databasePath);
    this.db = drizzle(sqlite);
    this.defaultConfig = defaultConfig;
    this.resourceConfigs = resourceConfigs;

    this.initializeDatabase();
  }

  async canProceed(resource: string): Promise<boolean> {
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean up old entries first
    await this.cleanupExpiredRequests(resource, windowStart);

    // Count current requests in the window
    const result = await this.db
      .select({ count: 'count(*)' })
      .from(rateLimitTable)
      .where(
        and(
          eq(rateLimitTable.resource, resource),
          gte(rateLimitTable.timestamp, windowStart),
        ),
      );

    const currentRequests = result[0]?.count || 0;
    return currentRequests < config.limit;
  }

  async record(resource: string): Promise<void> {
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
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean up old entries first
    await this.cleanupExpiredRequests(resource, windowStart);

    // Count current requests in the window
    const result = await this.db
      .select({ count: 'count(*)' })
      .from(rateLimitTable)
      .where(
        and(
          eq(rateLimitTable.resource, resource),
          gte(rateLimitTable.timestamp, windowStart),
        ),
      );

    const currentRequests = result[0]?.count || 0;
    const remaining = Math.max(0, config.limit - currentRequests);

    // Calculate reset time (when the window resets)
    const resetTime = new Date(now + config.windowMs);

    return {
      remaining,
      resetTime,
      limit: config.limit,
    };
  }

  async reset(resource: string): Promise<void> {
    await this.db
      .delete(rateLimitTable)
      .where(eq(rateLimitTable.resource, resource));
  }

  async getWaitTime(resource: string): Promise<number> {
    const config = this.resourceConfigs.get(resource) || this.defaultConfig;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean up old entries first
    await this.cleanupExpiredRequests(resource, windowStart);

    // Count current requests in the window
    const countResult = await this.db
      .select({ count: 'count(*)' })
      .from(rateLimitTable)
      .where(
        and(
          eq(rateLimitTable.resource, resource),
          gte(rateLimitTable.timestamp, windowStart),
        ),
      );

    const currentRequests = countResult[0]?.count || 0;

    if (currentRequests < config.limit) {
      return 0;
    }

    // Find the oldest request in the current window
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

    const oldestTimestamp = oldestResult[0].timestamp;
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
    rateLimitedResources: string[];
  }> {
    const totalResult = await this.db
      .select({ count: 'count(*)' })
      .from(rateLimitTable);

    const resourcesResult = await this.db
      .select({ resource: rateLimitTable.resource })
      .from(rateLimitTable)
      .groupBy(rateLimitTable.resource);

    const uniqueResources = resourcesResult.length;
    const rateLimitedResources: string[] = [];

    // Check which resources are currently rate limited
    for (const { resource } of resourcesResult) {
      const canProceed = await this.canProceed(resource);
      if (!canProceed) {
        rateLimitedResources.push(resource);
      }
    }

    return {
      totalRequests: totalResult[0]?.count || 0,
      uniqueResources,
      rateLimitedResources,
    };
  }

  /**
   * Clean up all rate limit data
   */
  async clear(): Promise<void> {
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

    // Clean up each resource individually
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
    // Close the SQLite connection
    (this.db as any).close?.();
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
    this.db.run(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    // Create index on resource and timestamp for efficient queries
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_rate_limits_resource_timestamp
      ON rate_limits(resource, timestamp)
    `);
  }
}
