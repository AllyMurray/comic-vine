import { DedupeStore } from '@comic-vine/client';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, lt } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { dedupeTable } from './schema.js';

export class SQLiteDedupeStore implements DedupeStore {
  private db: BetterSQLite3Database;
  private jobPromises = new Map<string, Promise<any>>();
  private jobResolvers = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  >();
  private readonly jobTimeoutMs: number;

  constructor(
    databasePath: string = ':memory:',
    options: { jobTimeoutMs?: number } = {},
  ) {
    const sqlite = new Database(databasePath);
    this.db = drizzle(sqlite);
    this.jobTimeoutMs = options.jobTimeoutMs ?? 300000; // 5 minutes default

    this.initializeDatabase();
  }

  async waitFor(hash: string): Promise<any | undefined> {
    // First check if we have a promise in memory
    const existingPromise = this.jobPromises.get(hash);
    if (existingPromise) {
      try {
        return await existingPromise;
      } catch (error) {
        // Remove failed promise from memory
        this.jobPromises.delete(hash);
        this.jobResolvers.delete(hash);
        throw error;
      }
    }

    // Check database for existing job
    const result = await this.db
      .select()
      .from(dedupeTable)
      .where(eq(dedupeTable.hash, hash))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const job = result[0];
    const now = Date.now();

    // Check if job has expired
    if (now - job.createdAt > this.jobTimeoutMs) {
      await this.db.delete(dedupeTable).where(eq(dedupeTable.hash, hash));
      return undefined;
    }

    // If job is completed, return the result
    if (job.status === 'completed') {
      return job.result;
    }

    // If job failed, throw the error
    if (job.status === 'failed') {
      throw new Error(job.error || 'Job failed');
    }

    // Job is still pending - create a promise that will be resolved when the job completes
    const promise = new Promise<any>((resolve, reject) => {
      this.jobResolvers.set(hash, { resolve, reject });

      // Set a timeout to reject the promise if job takes too long
      setTimeout(() => {
        const resolver = this.jobResolvers.get(hash);
        if (resolver) {
          resolver.reject(
            new Error('Job timeout: Request took too long to complete'),
          );
          this.jobResolvers.delete(hash);
          this.jobPromises.delete(hash);
        }
      }, this.jobTimeoutMs);
    });

    this.jobPromises.set(hash, promise);
    return promise;
  }

  async register(hash: string): Promise<string> {
    const now = Date.now();

    // Check if job already exists
    const existingJob = await this.db
      .select()
      .from(dedupeTable)
      .where(eq(dedupeTable.hash, hash))
      .limit(1);

    if (existingJob.length > 0) {
      const job = existingJob[0];

      // Check if job has expired
      if (now - job.createdAt > this.jobTimeoutMs) {
        await this.db.delete(dedupeTable).where(eq(dedupeTable.hash, hash));
      } else {
        return job.jobId;
      }
    }

    // Create new job
    const jobId = randomUUID();
    await this.db
      .insert(dedupeTable)
      .values({
        hash,
        jobId,
        status: 'pending',
        result: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: dedupeTable.hash,
        set: {
          jobId,
          status: 'pending',
          result: null,
          error: null,
          createdAt: now,
          updatedAt: now,
        },
      });

    return jobId;
  }

  async complete(hash: string, value: any): Promise<void> {
    const now = Date.now();

    await this.db
      .update(dedupeTable)
      .set({
        status: 'completed',
        result: value,
        error: null,
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
    const now = Date.now();

    await this.db
      .update(dedupeTable)
      .set({
        status: 'failed',
        result: null,
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
    const result = await this.db
      .select()
      .from(dedupeTable)
      .where(eq(dedupeTable.hash, hash))
      .limit(1);

    if (result.length === 0) {
      return false;
    }

    const job = result[0];
    const now = Date.now();

    // Check if job has expired
    if (now - job.createdAt > this.jobTimeoutMs) {
      await this.db.delete(dedupeTable).where(eq(dedupeTable.hash, hash));
      return false;
    }

    return job.status === 'pending';
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
    const cutoff = now - this.jobTimeoutMs;

    const stats = await this.db
      .select({
        total: 'count(*)',
        pending: `sum(case when status = 'pending' then 1 else 0 end)`,
        completed: `sum(case when status = 'completed' then 1 else 0 end)`,
        failed: `sum(case when status = 'failed' then 1 else 0 end)`,
        expired: `sum(case when created_at < ${cutoff} then 1 else 0 end)`,
      })
      .from(dedupeTable);

    const result = stats[0];
    return {
      totalJobs: result?.total || 0,
      pendingJobs: result?.pending || 0,
      completedJobs: result?.completed || 0,
      failedJobs: result?.failed || 0,
      expiredJobs: result?.expired || 0,
    };
  }

  /**
   * Clean up expired jobs
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const cutoff = now - this.jobTimeoutMs;

    await this.db.delete(dedupeTable).where(lt(dedupeTable.createdAt, cutoff));
  }

  /**
   * Clear all jobs
   */
  async clear(): Promise<void> {
    await this.db.delete(dedupeTable);

    // Reject all pending promises
    for (const [hash, resolver] of this.jobResolvers) {
      resolver.reject(new Error('DedupeStore cleared'));
    }
    this.jobResolvers.clear();
    this.jobPromises.clear();
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    // Reject all pending promises
    for (const [hash, resolver] of this.jobResolvers) {
      resolver.reject(new Error('DedupeStore closed'));
    }
    this.jobResolvers.clear();
    this.jobPromises.clear();

    // Close the SQLite connection
    (this.db as any).close?.();
  }

  private initializeDatabase(): void {
    // Create tables if they don't exist
    this.db.run(`
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

    // Create index on created_at for efficient cleanup
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_dedupe_created_at ON dedupe_jobs(created_at)
    `);
  }
}
