import { CacheStore } from '@comic-vine/client';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, lt } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { cacheTable } from './schema.js';

export class SQLiteCacheStore implements CacheStore {
  private db: BetterSQLite3Database;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly cleanupIntervalMs: number;

  constructor(
    databasePath: string = ':memory:',
    options: { cleanupIntervalMs?: number } = {},
  ) {
    const sqlite = new Database(databasePath);
    this.db = drizzle(sqlite);
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute default

    this.initializeDatabase();
    this.startCleanupInterval();
  }

  async get(hash: string): Promise<any | undefined> {
    const now = Date.now();

    const result = await this.db
      .select()
      .from(cacheTable)
      .where(eq(cacheTable.hash, hash))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const cacheItem = result[0];
    if (now > cacheItem.expiresAt) {
      // Item expired, delete it
      await this.db.delete(cacheTable).where(eq(cacheTable.hash, hash));
      return undefined;
    }

    return cacheItem.value;
  }

  async set(hash: string, value: any, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;

    await this.db
      .insert(cacheTable)
      .values({
        hash,
        value,
        expiresAt,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: cacheTable.hash,
        set: {
          value,
          expiresAt,
          createdAt: now,
        },
      });
  }

  async delete(hash: string): Promise<void> {
    await this.db.delete(cacheTable).where(eq(cacheTable.hash, hash));
  }

  async clear(): Promise<void> {
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
      .select({ count: 'count(*)' })
      .from(cacheTable);

    const expiredResult = await this.db
      .select({ count: 'count(*)' })
      .from(cacheTable)
      .where(lt(cacheTable.expiresAt, now));

    // Get database size (this is approximate)
    const dbStats = (this.db as any).run(
      'PRAGMA page_count; PRAGMA page_size;',
    );
    const pageCount = dbStats?.page_count || 0;
    const pageSize = dbStats?.page_size || 0;
    const databaseSizeKB = Math.round((pageCount * pageSize) / 1024);

    return {
      totalItems: totalResult[0]?.count || 0,
      expiredItems: expiredResult[0]?.count || 0,
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
   * Close the database connection and stop cleanup
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Close the SQLite connection
    (this.db as any).close?.();
  }

  private initializeDatabase(): void {
    // Create tables if they don't exist
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cache (
        hash TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Create index on expires_at for efficient cleanup
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)
    `);
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, this.cleanupIntervalMs);
  }
}
