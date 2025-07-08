import { randomUUID } from 'crypto';
import type { DedupeStore } from '@comic-vine/client';

// Simple deferred promise helper to avoid non-null assertions
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject } as const;
}

interface DedupeJob<T> {
  jobId: string;
  promise: Promise<T | undefined>;
  resolve: (value: T | undefined) => void;
  reject: (reason: unknown) => void;
  createdAt: number;
  completed: boolean;
  result?: T;
  error?: Error;
}

export class InMemoryDedupeStore<T = unknown> implements DedupeStore<T> {
  private jobs = new Map<string, DedupeJob<T>>();
  private readonly jobTimeoutMs: number;
  private cleanupInterval?: NodeJS.Timeout;
  private totalJobsProcessed: number = 0;
  private destroyed: boolean = false;

  constructor(
    options: { jobTimeoutMs?: number; cleanupIntervalMs?: number } = {},
  ) {
    this.jobTimeoutMs = options.jobTimeoutMs ?? 300000; // 5 minutes default
    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute default

    if (cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);
    }
  }

  async waitFor(hash: string): Promise<T | undefined> {
    if (this.destroyed) {
      return undefined;
    }

    const job = this.jobs.get(hash);
    if (!job) {
      return undefined;
    }

    const jobTimedOut =
      this.jobTimeoutMs > 0 && Date.now() - job.createdAt > this.jobTimeoutMs;
    if (jobTimedOut) {
      this.cleanup();
      return undefined;
    }

    // If job is already completed, return the result or throw the error
    if (job.completed) {
      if (job.error) {
        return undefined; // Return undefined for failed jobs instead of throwing
      }
      return job.result;
    }

    try {
      return await job.promise;
    } catch {
      // The job promise was rejected, return undefined for failed jobs
      return undefined;
    }
  }

  async register(hash: string): Promise<string> {
    // Check if there's already a job for this hash
    const existingJob = this.jobs.get(hash);
    if (existingJob) {
      // Return the existing job ID
      return existingJob.jobId;
    }

    // Create a new job
    const jobId = randomUUID();
    const { promise, resolve, reject } = deferred<T | undefined>();

    const job: DedupeJob<T> = {
      jobId,
      promise,
      resolve,
      reject,
      createdAt: Date.now(),
      completed: false,
    };

    this.jobs.set(hash, job);
    this.totalJobsProcessed++;
    return jobId;
  }

  async complete(hash: string, value: T): Promise<void> {
    const job = this.jobs.get(hash);
    if (job && !job.completed) {
      job.completed = true;
      job.result = value;
      job.resolve(value);
    }
  }

  async fail(hash: string, error: Error): Promise<void> {
    const job = this.jobs.get(hash);
    if (job && !job.completed) {
      job.completed = true;
      job.error = error;
      job.reject(error);
    }
  }

  async isInProgress(hash: string): Promise<boolean> {
    const job = this.jobs.get(hash);
    if (!job) {
      return false;
    }

    const isJobExpired =
      this.jobTimeoutMs > 0 && Date.now() - job.createdAt > this.jobTimeoutMs;
    if (isJobExpired) {
      this.cleanup();
      return false;
    }

    return !job.completed;
  }

  /**
   * Get statistics about current dedupe jobs
   */
  getStats(): {
    activeJobs: number;
    totalJobsProcessed: number;
    expiredJobs: number;
    oldestJobAgeMs: number;
  } {
    const now = Date.now();
    let expiredJobs = 0;
    let oldestJobAgeMs = 0;
    let activeJobs = 0;

    for (const [_hash, job] of this.jobs) {
      const ageMs = now - job.createdAt;
      if (this.jobTimeoutMs > 0 && ageMs > this.jobTimeoutMs) {
        expiredJobs++;
      }
      if (ageMs > oldestJobAgeMs) {
        oldestJobAgeMs = ageMs;
      }
      // Only count jobs that are not completed as active
      if (!job.completed) {
        activeJobs++;
      }
    }

    return {
      activeJobs,
      totalJobsProcessed: this.totalJobsProcessed,
      expiredJobs,
      oldestJobAgeMs,
    };
  }

  /**
   * Clean up expired jobs
   */
  cleanup(): void {
    // Skip cleanup if timeout is disabled
    if (this.jobTimeoutMs <= 0) {
      return;
    }

    const now = Date.now();
    const toDelete: Array<string> = [];

    for (const [hash, job] of this.jobs) {
      if (now - job.createdAt > this.jobTimeoutMs) {
        if (!job.completed) {
          // Reject the expired job
          job.completed = true;
          job.error = new Error(
            'Job timeout: Request took too long to complete',
          );
          job.reject(job.error);
        }
        toDelete.push(hash);
      }
    }

    for (const hash of toDelete) {
      this.jobs.delete(hash);
    }
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    // Reject all pending jobs
    for (const [_hash, job] of this.jobs) {
      if (!job.completed) {
        job.completed = true;
        job.error = new Error('DedupeStore cleared');
        job.reject(job.error);
      }
    }
    this.jobs.clear();
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
    this.destroyed = true;
  }
}
