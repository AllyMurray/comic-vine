/**
 * Interface for caching API responses with TTL support
 */
export interface CacheStore<T = unknown> {
  /**
   * Retrieve a cached value by hash key
   * @param hash The hash key of the cached item
   * @returns The cached value or undefined if not found or expired
   */
  get(hash: string): Promise<T | undefined>;

  /**
   * Store a value in the cache with a TTL
   * @param hash The hash key for the cached item
   * @param value The value to cache
   * @param ttlSeconds TTL in seconds after which the item expires
   */
  set(hash: string, value: T, ttlSeconds: number): Promise<void>;

  /**
   * Remove a cached item by hash key
   * @param hash The hash key of the cached item
   */
  delete(hash: string): Promise<void>;

  /**
   * Clear all cached items
   */
  clear(): Promise<void>;
}
