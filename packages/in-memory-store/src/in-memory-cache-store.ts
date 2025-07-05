import { CacheStore } from '@comic-vine/client';

export class InMemoryCacheStore implements CacheStore {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: { cleanupIntervalMs?: number } = {}) {
    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute default

    if (cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);
    }
  }

  async get(hash: string): Promise<unknown | undefined> {
    const item = this.cache.get(hash);

    if (!item || Date.now() > item.expiresAt) {
      this.cache.delete(hash);
      return undefined;
    }
    return item.value;
  }

  async set(hash: string, value: unknown, ttlSeconds: number): Promise<void> {
    const expiresAt = ttlSeconds === 0 ? 0 : Date.now() + ttlSeconds * 1000;
    this.cache.set(hash, {
      value,
      expiresAt,
    });
  }

  async delete(hash: string): Promise<void> {
    this.cache.delete(hash);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get statistics about cache usage
   */
  getStats(): {
    totalItems: number;
    expired: number;
    memoryUsageBytes: number;
  } {
    const now = Date.now();
    let expired = 0;

    for (const [_hash, item] of this.cache) {
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
   * Clean up expired cache entries
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
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.cache.clear();
  }
}
