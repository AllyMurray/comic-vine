import { DedupeStore } from '@comic-vine/client';
import { randomUUID } from 'crypto';

interface DedupeJob {
  jobId: string;
  promise: Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

export class InMemoryDedupeStore implements DedupeStore {
  private jobs = new Map<string, DedupeJob>();
  private readonly jobTimeoutMs: number;
  private cleanupInterval?: NodeJS.Timeout;
  private totalJobsProcessed: number = 0;

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

  async waitFor(hash: string): Promise<any | undefined> {
    const job = this.jobs.get(hash);
    if (!job) {
      return undefined;
    }

    // Check if job has expired
    if (Date.now() - job.createdAt > this.jobTimeoutMs) {
      this.jobs.delete(hash);
      return undefined;
    }

    try {
      return await job.promise;
    } catch (error) {
      // If the job failed, remove it from the map
      this.jobs.delete(hash);
      throw error;
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
    let resolve: (value: any) => void;
    let reject: (error: Error) => void;

    const promise = new Promise<any>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const job: DedupeJob = {
      jobId,
      promise,
      resolve: resolve!,
      reject: reject!,
      createdAt: Date.now(),
    };

    this.jobs.set(hash, job);
    return jobId;
  }

  async complete(hash: string, value: any): Promise<void> {
    const job = this.jobs.get(hash);
    if (job) {
      job.resolve(value);
      this.jobs.delete(hash);
      this.totalJobsProcessed++;
    }
  }

  async fail(hash: string, error: Error): Promise<void> {
    const job = this.jobs.get(hash);
    if (job) {
      job.reject(error);
      this.jobs.delete(hash);
      this.totalJobsProcessed++;
    }
  }

  async isInProgress(hash: string): Promise<boolean> {
    const job = this.jobs.get(hash);
    if (!job) {
      return false;
    }

    // Check if job has expired
    if (Date.now() - job.createdAt > this.jobTimeoutMs) {
      this.jobs.delete(hash);
      return false;
    }

    return true;
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

    for (const [hash, job] of this.jobs) {
      const ageMs = now - job.createdAt;
      if (ageMs > this.jobTimeoutMs) {
        expiredJobs++;
      }
      if (ageMs > oldestJobAgeMs) {
        oldestJobAgeMs = ageMs;
      }
    }

    return {
      activeJobs: this.jobs.size,
      totalJobsProcessed: this.totalJobsProcessed,
      expiredJobs,
      oldestJobAgeMs,
    };
  }

  /**
   * Clean up expired jobs
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [hash, job] of this.jobs) {
      if (now - job.createdAt > this.jobTimeoutMs) {
        // Reject the expired job
        job.reject(new Error('Job timeout: Request took too long to complete'));
        toDelete.push(hash);
        this.totalJobsProcessed++;
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
    for (const [hash, job] of this.jobs) {
      job.reject(new Error('DedupeStore cleared'));
      this.totalJobsProcessed++;
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
  }
}
