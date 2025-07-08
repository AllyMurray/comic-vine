import { ComicVine } from '@comic-vine/client';
import { InMemoryCacheStore } from '@comic-vine/in-memory-store';

// Example of setting up a memory-managed cache store
async function setupMemoryManagedCache() {
  // Create a cache store with memory management
  const cacheStore = new InMemoryCacheStore({
    // Cleanup expired items every 30 seconds
    cleanupIntervalMs: 30000,

    // Maximum 500 items in cache
    maxItems: 500,

    // Maximum 10MB of memory usage
    maxMemoryBytes: 10 * 1024 * 1024, // 10MB

    // When memory limit exceeded, evict 20% of oldest items
    evictionRatio: 0.2,
  });

  // Create Comic Vine client with the cache store
  const client = new ComicVine(
    'your-api-key',
    {},
    { cache: cacheStore },
    { defaultCacheTTL: 3600 }, // 1 hour cache
  );

  return { client, cacheStore };
}

// Example of monitoring cache performance
async function monitorCachePerformance(cacheStore: InMemoryCacheStore) {
  const stats = cacheStore.getStats();

  console.log('Cache Statistics:');
  console.log(`Total Items: ${stats.totalItems}/${stats.maxItems}`);
  console.log(
    `Memory Usage: ${(stats.memoryUsageBytes / 1024 / 1024).toFixed(2)} MB / ${(stats.maxMemoryBytes / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(
    `Memory Utilization: ${(stats.memoryUtilization * 100).toFixed(1)}%`,
  );
  console.log(`Item Utilization: ${(stats.itemUtilization * 100).toFixed(1)}%`);
  console.log(`Expired Items: ${stats.expired}`);

  // Check if we're approaching limits
  if (stats.memoryUtilization > 0.8) {
    console.warn('⚠️  Memory utilization is high (>80%)');
  }

  if (stats.itemUtilization > 0.9) {
    console.warn('⚠️  Item utilization is high (>90%)');
  }

  // Show least recently used items for debugging
  const lruItems = cacheStore.getLRUItems(5);
  console.log('\nLeast Recently Used Items:');
  lruItems.forEach((item, index) => {
    console.log(
      `${index + 1}. Hash: ${item.hash.substring(0, 20)}... Size: ${(item.size / 1024).toFixed(2)} KB, Last Accessed: ${item.lastAccessed.toLocaleString()}`,
    );
  });
}

// Example of different cache configurations for different use cases
function createCacheForDifferentUseCases() {
  // Small application - conservative memory usage
  const smallAppCache = new InMemoryCacheStore({
    maxItems: 100,
    maxMemoryBytes: 1024 * 1024, // 1MB
    cleanupIntervalMs: 60000, // 1 minute cleanup
  });

  // Medium application - balanced performance
  const mediumAppCache = new InMemoryCacheStore({
    maxItems: 1000,
    maxMemoryBytes: 50 * 1024 * 1024, // 50MB (default)
    cleanupIntervalMs: 30000, // 30 seconds cleanup
  });

  // Large application - high performance
  const largeAppCache = new InMemoryCacheStore({
    maxItems: 5000,
    maxMemoryBytes: 200 * 1024 * 1024, // 200MB
    cleanupIntervalMs: 10000, // 10 seconds cleanup
    evictionRatio: 0.1, // Evict only 10% when needed
  });

  return { smallAppCache, mediumAppCache, largeAppCache };
}

// Example of cache optimization strategies
async function optimizeCacheUsage(
  client: ComicVine,
  cacheStore: InMemoryCacheStore,
) {
  // Strategy 1: Use appropriate cache TTL based on data freshness needs
  // Popular characters change less frequently
  const popularCharacter = await client.character.retrieve(1699); // Spider-Man

  // Issues might change more frequently (ratings, reviews)
  const recentIssue = await client.issue.retrieve(142); // Some recent issue

  // Strategy 2: Monitor and adjust cache size based on usage patterns
  const stats = cacheStore.getStats();

  if (stats.memoryUtilization > 0.9) {
    console.log('🔄 Memory usage high, consider:');
    console.log('- Reducing cache TTL for less critical data');
    console.log('- Increasing maxMemoryBytes if possible');
    console.log('- Increasing evictionRatio for more aggressive cleanup');
  }

  // Strategy 3: Pre-warm cache with frequently accessed data
  console.log('🔥 Pre-warming cache with popular data...');
  const popularCharacterIds = [1699, 1443, 1458, 1458, 1468]; // Spider-Man, Superman, Batman, etc.

  for (const id of popularCharacterIds) {
    await client.character.retrieve(id);
  }

  console.log('✅ Cache pre-warming complete');
}

// Example of cache cleanup and maintenance
async function maintainCache(cacheStore: InMemoryCacheStore) {
  // Manual cleanup of expired items
  cacheStore.cleanup();

  // Check stats after cleanup
  const statsAfterCleanup = cacheStore.getStats();
  console.log(`Cleaned up ${statsAfterCleanup.expired} expired items`);

  // If memory is still high, manually clear some data
  if (statsAfterCleanup.memoryUtilization > 0.95) {
    console.log('⚠️  Memory critically high, clearing cache...');
    await cacheStore.clear();
  }
}

// Example of graceful shutdown
async function shutdownCache(cacheStore: InMemoryCacheStore) {
  console.log('🛑 Shutting down cache...');

  // Get final stats
  const finalStats = cacheStore.getStats();
  console.log(
    `Final cache stats: ${finalStats.totalItems} items, ${(finalStats.memoryUsageBytes / 1024 / 1024).toFixed(2)} MB`,
  );

  // Destroy the cache and cleanup resources
  cacheStore.destroy();

  console.log('✅ Cache shutdown complete');
}

// Main example function
async function main() {
  const { client, cacheStore } = await setupMemoryManagedCache();

  try {
    // Monitor cache performance periodically
    const monitoringInterval = setInterval(() => {
      monitorCachePerformance(cacheStore);
    }, 10000); // Every 10 seconds

    // Simulate some API usage
    console.log('🚀 Starting API usage simulation...');
    await optimizeCacheUsage(client, cacheStore);

    // Simulate maintenance
    await maintainCache(cacheStore);

    // Cleanup monitoring
    clearInterval(monitoringInterval);
  } finally {
    // Always clean up
    await shutdownCache(cacheStore);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export {
  setupMemoryManagedCache,
  monitorCachePerformance,
  createCacheForDifferentUseCases,
  optimizeCacheUsage,
  maintainCache,
  shutdownCache,
};
