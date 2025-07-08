import type { CacheStore } from '@comic-vine/client';
import Database from 'better-sqlite3';
import { eq, lt, count, sql } from 'drizzle-orm';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { cacheTable } from './schema.js';

export class SQLiteCacheStore<T = unknown> implements CacheStore<T> {
  private db: BetterSQLite3Database;
  private sqlite: InstanceType<typeof Database>;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly cleanupIntervalMs: number;
  private isDestroyed = false;

  constructor(
    databasePath: string = ':memory:',
    options: { cleanupIntervalMs?: number } = {},
  ) {
    const sqliteInstance = new Database(databasePath);
    this.sqlite = sqliteInstance;
    this.db = drizzle(sqliteInstance);
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute default

    this.initializeDatabase();
    this.startCleanupInterval();
  }

  async get(hash: string): Promise<T | undefined> {
    if (this.isDestroyed) {
      throw new Error('Cache store has been destroyed');
    }

    const result = await this.db
      .select()
      .from(cacheTable)
      .where(eq(cacheTable.hash, hash))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const item = result[0];
    if (!item) {
      return undefined;
    }

    const now = Date.now();

    if (now >= item.expiresAt) {
      await this.db.delete(cacheTable).where(eq(cacheTable.hash, hash));
      return undefined;
    }

    try {
      if (item.value === '__UNDEFINED__') {
        return undefined;
      }
      return JSON.parse(item.value as string);
    } catch {
      // If deserialization fails, remove the corrupted item
      await this.db.delete(cacheTable).where(eq(cacheTable.hash, hash));
      return undefined;
    }
  }

  async set(hash: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Cache store has been destroyed');
    }

    const now = Date.now();
    const expiresAt = ttlSeconds <= 0 ? now : now + ttlSeconds * 1000;

    let serializedValue: string;
    try {
      if (value === undefined) {
        serializedValue = '__UNDEFINED__';
      } else {
        serializedValue = JSON.stringify(value);
      }
    } catch (error) {
      throw new Error(
        `Failed to serialize value: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await this.db
      .insert(cacheTable)
      .values({
        hash,
        value: serializedValue,
        expiresAt,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: cacheTable.hash,
        set: {
          value: serializedValue,
          expiresAt,
          createdAt: now,
        },
      });
  }

  async delete(hash: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Cache store has been destroyed');
    }
    await this.db.delete(cacheTable).where(eq(cacheTable.hash, hash));
  }

  async clear(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Cache store has been destroyed');
    }
    await this.db.delete(cacheTable);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalItems: number;
    expiredItems: number;
    databaseSizeKB: number;
  }> {
    const now = Date.now();

    const totalResult = await this.db
      .select({ count: count() })
      .from(cacheTable);

    const expiredResult = await this.db
      .select({ count: count() })
      .from(cacheTable)
      .where(lt(cacheTable.expiresAt, now));

    // Get database size (approximate)
    const pageCount = this.sqlite.pragma('page_count', {
      simple: true,
    }) as number;
    const pageSize = this.sqlite.pragma('page_size', {
      simple: true,
    }) as number;
    const databaseSizeKB = Math.round((pageCount * pageSize) / 1024);

    return {
      totalItems: (totalResult[0] as { count?: number })?.count || 0,
      expiredItems: (expiredResult[0] as { count?: number })?.count || 0,
      databaseSizeKB,
    };
  }

  /**
   * Manually trigger cleanup of expired items
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    await this.db.delete(cacheTable).where(lt(cacheTable.expiresAt, now));
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

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

  private initializeDatabase(): void {
    // Create table if it doesn't exist
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS cache (
        hash TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Create index on expires_at for efficient cleanup
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)
    `);
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, this.cleanupIntervalMs);
  }

  private async cleanupExpiredItems(): Promise<void> {
    const now = Date.now();
    await this.db.delete(cacheTable).where(lt(cacheTable.expiresAt, now));
  }
}
