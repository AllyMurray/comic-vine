import ComicVine from '@comic-vine/client';
import { InMemoryCacheStore } from '@comic-vine/in-memory-store';

// Create a memory-managed cache store
const cache = new InMemoryCacheStore({
  maxSize: 1000, // Maximum 1000 cached items
  ttl: 300000, // 5 minutes TTL
  cleanupIntervalMs: 60000, // Cleanup every minute
});

// Create ComicVine client with memory-managed cache
const client = new ComicVine({
  apiKey: 'your-api-key-here',
  stores: {
    cache,
  },
});

async function demonstrateMemoryManagedCache() {
  console.log('=== Memory-Managed Cache Demo ===\n');

  // First request - will hit the API
  console.log('1. First request (cache miss):');
  const start1 = Date.now();
  const issue1 = await client.issue.retrieve(1);
  const time1 = Date.now() - start1;
  console.log(`   Retrieved issue: ${issue1.name}`);
  console.log(`   Time taken: ${time1}ms\n`);

  // Second request - will hit the cache
  console.log('2. Second request (cache hit):');
  const start2 = Date.now();
  const issue2 = await client.issue.retrieve(1);
  const time2 = Date.now() - start2;
  console.log(`   Retrieved issue: ${issue2.name}`);
  console.log(`   Time taken: ${time2}ms`);
  console.log(
    `   Cache speedup: ${Math.round((time1 / time2) * 100) / 100}x\n`,
  );

  // Demonstrate cache stats
  console.log('3. Cache statistics:');
  console.log(`   Cache stats: ${JSON.stringify(cache.getStats(), null, 2)}\n`);

  // Demonstrate memory management
  console.log('4. Memory management:');
  console.log('   Filling cache to trigger LRU eviction...');

  // Fill cache beyond max size to trigger LRU eviction
  for (let i = 2; i <= 1002; i++) {
    try {
      await client.issue.retrieve(i);
      if (i % 100 === 0) {
        console.log(`   Cached ${i} items...`);
      }
    } catch (error) {
      // Some issues might not exist, continue
      continue;
    }
  }

  console.log('\n   Final cache stats:');
  console.log(`   ${JSON.stringify(cache.getStats(), null, 2)}`);

  // Verify first item was evicted due to LRU
  console.log('\n5. LRU eviction verification:');
  const start3 = Date.now();
  const issue3 = await client.issue.retrieve(1); // Should be cache miss again
  const time3 = Date.now() - start3;
  console.log(`   Time for issue 1: ${time3}ms`);
  console.log(
    `   ${time3 > 50 ? 'Cache miss (evicted)' : 'Cache hit (still cached)'}`,
  );
}

demonstrateMemoryManagedCache().catch(console.error);
