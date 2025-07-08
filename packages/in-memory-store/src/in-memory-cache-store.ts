import type { CacheStore } from '@comic-vine/client';
// We use fast-safe-stringify instead of JSON.stringify so that
// 1) objects containing circular references don’t throw, and
// 2) we get a deterministic string length for accurate memory-usage
//    calculations.  A normal JSON.stringify would either error or
//    force us to fallback to a rough 1 KB estimate, under-reporting
//    large cyclic payloads.
import safeStringify from 'fast-safe-stringify';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
  size: number; // bytes occupied by this entry
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

export class InMemoryCacheStore<T = unknown> implements CacheStore<T> {
  private cache = new Map<string, CacheItem<T>>();
  private cleanupInterval?: NodeJS.Timeout;
  private readonly maxItems: number;
  private readonly maxMemoryBytes: number;
  private readonly evictionRatio: number;
  private totalSize = 0; // running total of memory usage in bytes

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

  async get(hash: string): Promise<T | undefined> {
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

  async set(hash: string, value: T, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const expiresAt = ttlSeconds === 0 ? 0 : now + ttlSeconds * 1000;

    // If replacing an existing entry, subtract its size first
    const existing = this.cache.get(hash);
    if (existing) {
      this.totalSize -= existing.size;
    }

    const entrySize = this.estimateEntrySize(hash, value);
    this.totalSize += entrySize;

    this.cache.set(hash, {
      value,
      expiresAt,
      lastAccessed: now,
      size: entrySize,
    });

    // Check if we need to evict items
    this.enforceMemoryLimits();
  }

  async delete(hash: string): Promise<void> {
    const existing = this.cache.get(hash);
    if (existing) {
      this.totalSize -= existing.size;
    }
    this.cache.delete(hash);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.totalSize = 0;
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
      const item = this.cache.get(hash);
      if (item) {
        this.totalSize -= item.size;
      }
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
    const memoryUsage = this.totalSize;
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
      const entry = entries[i];
      if (entry) {
        const [key, item] = entry;
        this.totalSize -= item.size;
        this.cache.delete(key);
      }
    }
  }

  /**
   * Calculate rough memory usage
   */
  private calculateMemoryUsage(): number {
    // O(1) – maintained incrementally
    return this.totalSize;
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
      size: item.size,
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
    this.totalSize = 0;
  }

  /**
   * Estimate the size in bytes of a cache entry (key + value + metadata)
   */
  private estimateEntrySize(hash: string, value: unknown): number {
    let size = 0;

    // Hash key size (UTF-16 => 2 bytes per char)
    size += hash.length * 2;

    // Metadata size (expiresAt & lastAccessed)
    size += 16;

    // Value size via safe-stringify
    try {
      const json = safeStringify(value) ?? '';
      size += json.length * 2;
    } catch {
      size += 1024; // fallback estimate
    }

    return size;
  }
}
