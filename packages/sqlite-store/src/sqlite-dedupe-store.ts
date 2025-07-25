import { randomUUID } from 'crypto';
import type { DedupeStore } from '@comic-vine/client';
import Database from 'better-sqlite3';
import { eq, lt, count, sql, and } from 'drizzle-orm';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { dedupeTable } from './schema.js';

export interface SQLiteDedupeStoreOptions {
  database?: string | InstanceType<typeof Database>;
  jobTimeoutMs?: number;
  timeoutMs?: number;
  cleanupIntervalMs?: number;
}

export class SQLiteDedupeStore<T = unknown> implements DedupeStore<T> {
  private db: BetterSQLite3Database;
  private sqlite: InstanceType<typeof Database>;
  /** Indicates whether this store manages (and should close) the SQLite connection */
  private readonly isConnectionManaged: boolean = false;
  private jobPromises = new Map<string, Promise<T | undefined>>();
  private jobResolvers = new Map<
    string,
    {
      resolve: (value: T | undefined) => void;
      reject: (reason: unknown) => void;
    }
  >();
  private readonly jobTimeoutMs: number;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly cleanupIntervalMs: number;
  private isDestroyed = false;

  constructor({
    /** File path or existing `better-sqlite3` Database instance. Defaults to `':memory:'`. */
    database = ':memory:',
    /** Job timeout in milliseconds. Preferred over timeoutMs. */
    jobTimeoutMs,
    /** Legacy alias for jobTimeoutMs. */
    timeoutMs,
    /** Cleanup interval in milliseconds. Defaults to 1 minute. */
    cleanupIntervalMs = 60_000,
  }: SQLiteDedupeStoreOptions = {}) {
    // Support passing an existing `better-sqlite3` Database instance so that
    // multiple stores can share the *same* file and connection. If a string
    // path is provided we create the connection ourselves and therefore take
    // ownership of it for later cleanup.
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
    this.jobTimeoutMs = timeoutMs ?? jobTimeoutMs ?? 300000;
    this.cleanupIntervalMs = cleanupIntervalMs;

    this.initializeDatabase();
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    if (this.cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredJobs().catch(() => {
          // Ignore cleanup errors
        });
      }, this.cleanupIntervalMs);
      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }

  private async cleanupExpiredJobs(): Promise<void> {
    const noTimeoutConfigured = this.jobTimeoutMs <= 0;
    if (noTimeoutConfigured) {
      return;
    }

    const now = Date.now();
    const expiredThreshold = now - this.jobTimeoutMs;

    // Delete expired pending jobs
    await this.db
      .delete(dedupeTable)
      .where(
        and(
          eq(dedupeTable.status, 'pending'),
          lt(dedupeTable.createdAt, expiredThreshold),
        ),
      );
  }

  async waitFor(hash: string): Promise<T | undefined> {
    if (this.isDestroyed) {
      throw new Error('Dedupe store has been destroyed');
    }

    const existingPromise = this.jobPromises.get(hash);
    if (existingPromise) {
      return existingPromise;
    }

    const result = await this.db
      .select()
      .from(dedupeTable)
      .where(eq(dedupeTable.hash, hash))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const job = result[0];
    if (!job) {
      return undefined;
    }

    // If job is already completed, return result immediately
    if (job.status === 'completed') {
      try {
        if (job.result === '__UNDEFINED__' || job.result === '__NULL__') {
          return undefined;
        } else if (job.result) {
          return JSON.parse(job.result as string);
        }
        return undefined;
      } catch {
        // If parse fails, return undefined instead of throwing
        return undefined;
      }
    }

    if (job.status === 'failed') {
      return undefined;
    }

    // Job is pending - create promise for deduplication
    const promise = new Promise<T | undefined>((resolve, reject) => {
      this.jobResolvers.set(hash, { resolve, reject });

      if (this.jobTimeoutMs > 0) {
        setTimeout(() => {
          const resolver = this.jobResolvers.get(hash);
          if (resolver) {
            this.jobResolvers.delete(hash);
            this.jobPromises.delete(hash);

            this.db
              .update(dedupeTable)
              .set({
                status: 'failed',
                error: 'Job timed out',
                updatedAt: Date.now(),
              })
              .where(eq(dedupeTable.hash, hash))
              .then(() => {
                resolve(undefined); // Resolve with undefined for timeout
              })
              .catch(() => {
                resolve(undefined); // Even if update fails, resolve with undefined
              });
          }
        }, this.jobTimeoutMs);
      }
    });

    this.jobPromises.set(hash, promise);
    return promise;
  }

  async register(hash: string): Promise<string> {
    if (this.isDestroyed) {
      throw new Error('Dedupe store has been destroyed');
    }

    const existingJob = await this.db
      .select()
      .from(dedupeTable)
      .where(eq(dedupeTable.hash, hash))
      .limit(1);

    if (existingJob.length > 0) {
      const job = existingJob[0];
      if (job && job.status === 'pending') {
        return job.jobId;
      }
    }

    // Create new job
    const jobId = randomUUID();
    const now = Date.now();

    await this.db
      .insert(dedupeTable)
      .values({
        hash,
        jobId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: dedupeTable.hash,
        set: {
          jobId,
          status: 'pending',
          updatedAt: now,
        },
      });

    return jobId;
  }

  async complete(hash: string, value: T | undefined): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Dedupe store has been destroyed');
    }

    // Handle different value types with proper serialization
    let serializedResult: string;
    if (value === undefined) {
      serializedResult = '__UNDEFINED__';
    } else if (value === null) {
      serializedResult = '__NULL__';
    } else {
      try {
        serializedResult = JSON.stringify(value);
      } catch (error) {
        throw new Error(
          `Failed to serialize result: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const now = Date.now();

    // Check if job already completed (prevent double completion)
    const existingJob = await this.db
      .select()
      .from(dedupeTable)
      .where(eq(dedupeTable.hash, hash))
      .limit(1);

    if (existingJob.length > 0 && existingJob[0]?.status === 'completed') {
      // Job already completed, don't update again
      return;
    }

    await this.db
      .update(dedupeTable)
      .set({
        status: 'completed',
        result: serializedResult,
        updatedAt: now,
      })
      .where(eq(dedupeTable.hash, hash));

    // Resolve any waiting promises
    const resolver = this.jobResolvers.get(hash);
    if (resolver) {
      resolver.resolve(value);
      this.jobResolvers.delete(hash);
      this.jobPromises.delete(hash);
    }
  }

  async fail(hash: string, error: Error): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Dedupe store has been destroyed');
    }

    const now = Date.now();

    await this.db
      .update(dedupeTable)
      .set({
        status: 'failed',
        error: error.message,
        updatedAt: now,
      })
      .where(eq(dedupeTable.hash, hash));

    // Reject any waiting promises
    const resolver = this.jobResolvers.get(hash);
    if (resolver) {
      resolver.reject(error);
      this.jobResolvers.delete(hash);
      this.jobPromises.delete(hash);
    }
  }

  async isInProgress(hash: string): Promise<boolean> {
    if (this.isDestroyed) {
      throw new Error('Dedupe store has been destroyed');
    }

    const result = await this.db
      .select()
      .from(dedupeTable)
      .where(eq(dedupeTable.hash, hash))
      .limit(1);

    if (result.length === 0) {
      return false;
    }

    const job = result[0];
    if (!job) {
      return false;
    }

    const jobExpired =
      this.jobTimeoutMs > 0 && Date.now() - job.createdAt >= this.jobTimeoutMs;
    if (jobExpired) {
      await this.db.delete(dedupeTable).where(eq(dedupeTable.hash, hash));
      return false;
    }

    return job.status === 'pending';
  }

  async getResult(hash: string): Promise<T | undefined> {
    const result = await this.db
      .select()
      .from(dedupeTable)
      .where(eq(dedupeTable.hash, hash))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const job = result[0];
    if (!job) {
      return undefined;
    }

    const now = Date.now();

    const isExpired = now - job.createdAt > this.jobTimeoutMs;
    if (isExpired) {
      await this.db.delete(dedupeTable).where(eq(dedupeTable.hash, hash));
      return undefined;
    }

    if (job.status === 'completed') {
      try {
        if (job.result === '__UNDEFINED__') {
          return undefined;
        } else if (job.result === '__NULL__') {
          return null as unknown as T;
        } else if (job.result) {
          return JSON.parse(job.result as string);
        }
        return undefined;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Get statistics about dedupe jobs
   */
  async getStats(): Promise<{
    totalJobs: number;
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    expiredJobs: number;
  }> {
    const now = Date.now();
    const expiredTime = now - this.jobTimeoutMs;

    const totalResult = await this.db
      .select({ count: count() })
      .from(dedupeTable);

    const pendingResult = await this.db
      .select({ count: count() })
      .from(dedupeTable)
      .where(eq(dedupeTable.status, 'pending'));

    const completedResult = await this.db
      .select({ count: count() })
      .from(dedupeTable)
      .where(eq(dedupeTable.status, 'completed'));

    const failedResult = await this.db
      .select({ count: count() })
      .from(dedupeTable)
      .where(eq(dedupeTable.status, 'failed'));

    const expiredResult = await this.db
      .select({ count: count() })
      .from(dedupeTable)
      .where(lt(dedupeTable.createdAt, expiredTime));

    return {
      totalJobs: totalResult[0]?.count || 0,
      pendingJobs: pendingResult[0]?.count || 0,
      completedJobs: completedResult[0]?.count || 0,
      failedJobs: failedResult[0]?.count || 0,
      expiredJobs: expiredResult[0]?.count || 0,
    };
  }

  /**
   * Clean up expired jobs
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredTime = now - this.jobTimeoutMs;

    await this.db
      .delete(dedupeTable)
      .where(lt(dedupeTable.createdAt, expiredTime));
  }

  /**
   * Clear all jobs
   */
  async clear(): Promise<void> {
    await this.db.delete(dedupeTable);

    this.jobPromises.clear();
    this.jobResolvers.clear();
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.jobPromises.clear();
    this.jobResolvers.clear();

    this.isDestroyed = true;

    // Only close the underlying DB if **this** store created it.
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

  private initializeDatabase(): void {
    // Create tables if they don't exist
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS dedupe_jobs (
        hash TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        status TEXT NOT NULL,
        result BLOB,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create index on status for efficient queries
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_dedupe_status ON dedupe_jobs(status)
    `);
  }
}
