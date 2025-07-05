/**
 * Example usage of the ComicVine client with integrated store support.
 * This demonstrates various ways to use caching, deduplication, and rate limiting
 * by injecting stores directly into the ComicVine constructor.
 */

import { ComicVine } from '@comic-vine/client';
import {
  InMemoryCacheStore,
  InMemoryDedupeStore,
  InMemoryRateLimitStore,
} from '@comic-vine/in-memory-store';
import {
  SQLiteCacheStore,
  SQLiteDedupeStore,
  SQLiteRateLimitStore,
} from '@comic-vine/sqlite-store';

// Example 1: Using in-memory stores
async function exampleWithInMemoryStores() {
  console.log('🧩 Example 1: In-Memory Stores');

  const client = new ComicVine(
    'your-comic-vine-api-key',
    undefined, // ComicVine options
    {
      cache: new InMemoryCacheStore(),
      dedupe: new InMemoryDedupeStore(),
      rateLimit: new InMemoryRateLimitStore(
        { limit: 100, windowMs: 60000 }, // 100 requests per minute
        new Map([
          ['issues', { limit: 50, windowMs: 60000 }], // 50 requests per minute for issues
          ['characters', { limit: 200, windowMs: 60000 }], // 200 requests per minute for characters
        ]),
      ),
    },
    {
      defaultCacheTTL: 3600, // 1 hour cache
      throwOnRateLimit: false, // Wait instead of throwing
      maxWaitTime: 30000, // Max 30 seconds wait
    },
  );

  try {
    // Retrieve an issue - will be cached
    console.log('Fetching issue #1...');
    const issue1 = await client.issue.retrieve(1);
    console.log('Issue retrieved:', issue1.name);

    // Same issue again - will hit cache
    console.log('Fetching issue #1 again (should hit cache)...');
    const issue1Cached = await client.issue.retrieve(1);
    console.log('Issue retrieved from cache:', issue1Cached.name);

    // List issues with rate limiting
    console.log('Listing issues...');
    const issuesList = await client.issue.list({ limit: 10 });
    console.log('Issues found:', issuesList.data.length);

    // Check rate limit status
    const rateLimitStatus = await client.getRateLimitStatus('issue');
    console.log('Rate limit status:', rateLimitStatus);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 2: Using SQLite stores for persistence
async function exampleWithSQLiteStores() {
  console.log('\n🧩 Example 2: SQLite Stores');

  const client = new ComicVine(
    'your-comic-vine-api-key',
    undefined, // ComicVine options
    {
      cache: new SQLiteCacheStore('./comic-vine-cache.db'),
      dedupe: new SQLiteDedupeStore('./comic-vine-dedupe.db'),
      rateLimit: new SQLiteRateLimitStore('./comic-vine-rate-limits.db', {
        limit: 100,
        windowMs: 60000,
      }),
    },
  );

  try {
    // Retrieve multiple characters concurrently - deduplication will prevent duplicate requests
    console.log('Fetching character #1 concurrently...');
    const promises = Array(5)
      .fill(null)
      .map(() => client.character.retrieve(1));
    const results = await Promise.all(promises);
    console.log('All requests completed, got', results.length, 'results');
    console.log('First result:', results[0].name);

    // List characters with pagination
    console.log('Listing characters...');
    const characters = client.character.list({ limit: 20 });

    // Iterate through results (handles pagination automatically)
    let count = 0;
    for await (const character of characters) {
      count++;
      console.log(`Character ${count}: ${character.name}`);
      if (count >= 5) break; // Just show first 5
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 3: Cache-only setup for development
async function exampleCacheOnly() {
  console.log('\n🧩 Example 3: Cache-Only Setup');

  const client = new ComicVine(
    'your-comic-vine-api-key',
    undefined, // ComicVine options
    {
      cache: new InMemoryCacheStore({ cleanupIntervalMs: 30000 }), // Cleanup every 30 seconds
    },
    {
      defaultCacheTTL: 300, // 5 minute cache
    },
  );

  try {
    // Fetch some data
    const volume = await client.volume.retrieve(1);
    console.log('Volume retrieved:', volume.name);

    // Check cache stats
    const cacheStats = client.getCacheStats();
    console.log('Client cache stats:', cacheStats);

    // Clear cache if needed
    await client.clearCache();
    console.log('Cache cleared');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 4: Rate limiting only for production API limits
async function exampleRateLimitingOnly() {
  console.log('\n🧩 Example 4: Rate Limiting Only');

  // Configure different limits for different resources
  const rateLimitConfigs = new Map([
    ['issues', { limit: 50, windowMs: 60000 }], // 50/min for issues
    ['characters', { limit: 100, windowMs: 60000 }], // 100/min for characters
    ['volumes', { limit: 30, windowMs: 60000 }], // 30/min for volumes
  ]);

  const client = new ComicVine(
    'your-comic-vine-api-key',
    undefined, // ComicVine options
    {
      rateLimit: new InMemoryRateLimitStore(
        { limit: 200, windowMs: 60000 }, // Default: 200/min
        rateLimitConfigs,
      ),
    },
    {
      throwOnRateLimit: true, // Throw errors when rate limited
    },
  );

  try {
    // Make rapid requests - will be rate limited
    console.log('Making rapid requests...');
    for (let i = 1; i <= 10; i++) {
      const issue = await client.issue.retrieve(i);
      console.log(`Issue ${i}: ${issue.name}`);

      // Check rate limit status
      const status = await client.getRateLimitStatus('issue');
      console.log(`Remaining requests: ${status.remaining}/${status.limit}`);
    }
  } catch (error) {
    if (error.message.includes('Rate limit exceeded')) {
      console.log('Rate limit hit - this is expected!');
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Run examples
async function runExamples() {
  console.log('🚀 Comic Vine Client with Integrated Store Examples\n');

  // Note: You'll need a real API key to run these examples
  console.log(
    '⚠️  Remember to replace "your-comic-vine-api-key" with your actual API key!\n',
  );

  await exampleWithInMemoryStores();
  await exampleWithSQLiteStores();
  await exampleCacheOnly();
  await exampleRateLimitingOnly();

  console.log('\n✅ All examples completed!');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}

export {
  exampleWithInMemoryStores,
  exampleWithSQLiteStores,
  exampleCacheOnly,
  exampleRateLimitingOnly,
};
