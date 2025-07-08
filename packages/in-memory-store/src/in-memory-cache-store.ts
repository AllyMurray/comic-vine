import { CacheStore } from '@comic-vine/client';

interface CacheItem {
  value: unknown;
  expiresAt: number;
  lastAccessed: number;
}

export interface InMemoryCacheStoreOptions {
  /** Cleanup interval in milliseconds. Set to 0 to disable automatic cleanup. Default: 60000 (1 minute) */
  cleanupIntervalMs?: number;
  /** Maximum number of items to store. When exceeded, least recently used items are evicted. Default: 1000 */
  maxItems?: number;
  /** Maximum memory usage in bytes (rough estimate). When exceeded, least recently used items are evicted. Default: 50MB */
  maxMemoryBytes?: number;
  /** When evicting items, remove this percentage of LRU items. Default: 0.1 (10%) */
  evictionRatio?: number;
}

export class InMemoryCacheStore implements CacheStore {
  private cache = new Map<string, CacheItem>();
  private cleanupInterval?: NodeJS.Timeout;
  private readonly maxItems: number;
  private readonly maxMemoryBytes: number;
  private readonly evictionRatio: number;

  constructor(options: InMemoryCacheStoreOptions = {}) {
    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute default
    this.maxItems = options.maxItems ?? 1000;
    this.maxMemoryBytes = options.maxMemoryBytes ?? 50 * 1024 * 1024; // 50MB default
    this.evictionRatio = options.evictionRatio ?? 0.1;

    if (cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);
    }
  }

  async get(hash: string): Promise<unknown | undefined> {
    const item = this.cache.get(hash);

    if (!item || (item.expiresAt > 0 && Date.now() > item.expiresAt)) {
      this.cache.delete(hash);
      return undefined;
    }

    // Update last accessed time for LRU
    item.lastAccessed = Date.now();
    // Re-set the item to trigger map ordering update
    this.cache.set(hash, item);
    return item.value;
  }

  async set(hash: string, value: unknown, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const expiresAt = ttlSeconds === 0 ? 0 : now + ttlSeconds * 1000;

    this.cache.set(hash, {
      value,
      expiresAt,
      lastAccessed: now,
    });

    // Check if we need to evict items
    this.enforceMemoryLimits();
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
    maxItems: number;
    maxMemoryBytes: number;
    memoryUtilization: number;
    itemUtilization: number;
  } {
    const now = Date.now();
    let expired = 0;

    for (const [_hash, item] of this.cache) {
      if (item.expiresAt > 0 && now > item.expiresAt) {
        expired++;
      }
    }

    // Rough estimate of memory usage
    const memoryUsageBytes = this.calculateMemoryUsage();

    return {
      totalItems: this.cache.size,
      expired,
      memoryUsageBytes,
      maxItems: this.maxItems,
      maxMemoryBytes: this.maxMemoryBytes,
      memoryUtilization: memoryUsageBytes / this.maxMemoryBytes,
      itemUtilization: this.cache.size / this.maxItems,
    };
  }

  /**
   * Clean up expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: Array<string> = [];

    for (const [hash, item] of this.cache) {
      if (item.expiresAt > 0 && now > item.expiresAt) {
        toDelete.push(hash);
      }
    }

    for (const hash of toDelete) {
      this.cache.delete(hash);
    }
  }

  /**
   * Enforce memory and item count limits using LRU eviction
   */
  private enforceMemoryLimits(): void {
    // Check item count limit
    if (this.cache.size > this.maxItems) {
      this.evictLRUItems(this.cache.size - this.maxItems);
      return;
    }

    // Check memory usage limit
    const memoryUsage = this.calculateMemoryUsage();
    if (memoryUsage > this.maxMemoryBytes) {
      const itemsToEvict = Math.max(
        1,
        Math.floor(this.cache.size * this.evictionRatio),
      );
      this.evictLRUItems(itemsToEvict);
    }
  }

  /**
   * Evict the least recently used items
   */
  private evictLRUItems(count: number): void {
    // Sort entries by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastAccessed - b.lastAccessed,
    );

    // Remove the oldest entries
    for (let i = 0; i < count && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Calculate rough memory usage
   */
  private calculateMemoryUsage(): number {
    // More accurate memory calculation
    let totalSize = 0;

    for (const [hash, item] of this.cache) {
      // Hash key size
      totalSize += hash.length * 2; // UTF-16 characters are 2 bytes each

      // Item metadata size (approximate)
      totalSize += 16; // expiresAt (8 bytes) + lastAccessed (8 bytes)

      // Value size (rough estimate using JSON serialization)
      try {
        totalSize += JSON.stringify(item.value).length * 2;
      } catch {
        // If JSON serialization fails, use a default estimate
        totalSize += 1024; // 1KB default estimate
      }
    }

    return totalSize;
  }

  /**
   * Get items sorted by last accessed time (for debugging/monitoring)
   */
  getLRUItems(
    limit: number = 10,
  ): Array<{ hash: string; lastAccessed: Date; size: number }> {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
      .slice(0, limit);

    return entries.map(([hash, item]) => ({
      hash,
      lastAccessed: new Date(item.lastAccessed),
      size: JSON.stringify(item.value).length * 2,
    }));
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
