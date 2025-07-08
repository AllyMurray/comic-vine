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
  /**
   * Maximum allowed size (in bytes) for a single cache entry. If the serialized
   * value exceeds this limit the entry will be **silently skipped** to avoid
   * breaching SQLite's max length limits which could otherwise throw at write
   * time. Defaults to `5 MiB`, which is well under SQLiteʼs compiled
   * `SQLITE_MAX_LENGTH` (usually 1 GiB) yet large enough for typical Comic Vine
   * responses.
   */
  private readonly maxEntrySizeBytes: number;
  private isDestroyed = false;

  constructor(
    databasePath: string = ':memory:',
    options: { cleanupIntervalMs?: number; maxEntrySizeBytes?: number } = {},
  ) {
    const sqliteInstance = new Database(databasePath);
    this.sqlite = sqliteInstance;
    this.db = drizzle(sqliteInstance);
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute default

    // Default to 5 MiB per entry unless explicitly overridden
    this.maxEntrySizeBytes = options.maxEntrySizeBytes ?? 5 * 1024 * 1024;

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

    // SIZE GUARD: Skip caching if the value is too large to avoid hitting
    // SQLite length limits. We **silently** skip because callers shouldn't be
    // penalised for large responses — they will simply be fetched again next
    // time.
    if (Buffer.byteLength(serializedValue, 'utf8') > this.maxEntrySizeBytes) {
      return;
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
    const pageCount = Number(
      this.sqlite.pragma('page_count', { simple: true }),
    );
    const pageSize = Number(this.sqlite.pragma('page_size', { simple: true }));

    // Fallback to 0 if parsing failed (NaN)
    const safePageCount = Number.isFinite(pageCount) ? pageCount : 0;
    const safePageSize = Number.isFinite(pageSize) ? pageSize : 0;
    const databaseSizeKB = Math.round((safePageCount * safePageSize) / 1024);

    return {
      databaseSizeKB,
      expiredItems: expiredResult[0]?.count ?? 0,
      totalItems: totalResult[0]?.count ?? 0,
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
    if (typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  private async cleanupExpiredItems(): Promise<void> {
    const now = Date.now();
    await this.db.delete(cacheTable).where(lt(cacheTable.expiresAt, now));
  }
}
