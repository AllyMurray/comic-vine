import { CacheStore } from '@comic-vine/client';

interface CacheItem {
  value: any;
  expiresAt: number;
}

export class InMemoryCacheStore implements CacheStore {
  private cache = new Map<string, CacheItem>();
  private cleanupInterval?: NodeJS.Timeout;
  private readonly cleanupIntervalMs: number;

  constructor(options: { cleanupIntervalMs?: number } = {}) {
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute default
    this.startCleanupInterval();
  }

  async get(hash: string): Promise<any | undefined> {
    const item = this.cache.get(hash);
    if (!item) {
      return undefined;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(hash);
      return undefined;
    }

    return item.value;
  }

  async set(hash: string, value: any, ttlSeconds: number): Promise<void> {
    const expiresAt = ttlSeconds === 0 ? 0 : Date.now() + ttlSeconds * 1000;
    this.cache.set(hash, { value, expiresAt });
  }

  async delete(hash: string): Promise<void> {
    this.cache.delete(hash);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalItems: number;
    expired: number;
    memoryUsageBytes: number;
  } {
    let expired = 0;
    const now = Date.now();

    for (const [hash, item] of this.cache) {
      if (now > item.expiresAt) {
        expired++;
      }
    }

    // Rough estimate of memory usage
    const memoryUsageBytes = JSON.stringify(
      Array.from(this.cache.entries()),
    ).length;

    return {
      totalItems: this.cache.size,
      expired,
      memoryUsageBytes,
    };
  }

  /**
   * Manually trigger cleanup of expired items
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [hash, item] of this.cache) {
      if (now > item.expiresAt) {
        toDelete.push(hash);
      }
    }

    for (const hash of toDelete) {
      this.cache.delete(hash);
    }
  }

  /**
   * Stop the cleanup interval and clear all data
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.cache.clear();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }
}
