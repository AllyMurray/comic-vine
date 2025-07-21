/**
 * Example usage of the ComicVine client with integrated store support.
 * This demonstrates various ways to use caching, deduplication, and rate limiting
 * by injecting stores directly into the ComicVine constructor.
 */

import ComicVine from '@comic-vine/client';
import { InMemoryRateLimitStore } from '@comic-vine/in-memory-store';

// Create a rate limit store with custom configuration
const rateLimitStore = new InMemoryRateLimitStore({
  defaultConfig: { limit: 100, windowMs: 60000 }, // 100 requests per minute default
  resourceConfigs: new Map([
    ['issues', { limit: 50, windowMs: 60000 }], // Issues: 50 requests per minute
    ['characters', { limit: 200, windowMs: 60000 }], // Characters: 200 requests per minute
    ['publishers', { limit: 30, windowMs: 60000 }], // Publishers: 30 requests per minute
  ]),
});

// Create ComicVine client with rate limiting
const client = new ComicVine({
  apiKey: 'your-api-key-here',
  stores: {
    rateLimit: rateLimitStore,
  },
  client: {
    throwOnRateLimit: false, // Wait instead of throwing errors
    maxWaitTime: 30000, // Maximum 30 seconds wait time
  },
});

async function demonstrateRateLimiting() {
  console.log('=== Rate Limiting Demo ===\n');

  // Demonstrate different rate limits for different resources
  console.log('1. Testing different resource rate limits:');

  // Test character requests (200 req/min limit)
  console.log('   Characters (200 req/min):');
  const characterStart = Date.now();
  for (let i = 1; i <= 5; i++) {
    const character = await client.character.retrieve(i);
    console.log(
      `     ${i}. ${character.name} (${Date.now() - characterStart}ms)`,
    );
  }

  // Test issue requests (50 req/min limit)
  console.log('\n   Issues (50 req/min):');
  const issueStart = Date.now();
  for (let i = 1; i <= 5; i++) {
    const issue = await client.issue.retrieve(i);
    console.log(`     ${i}. ${issue.name} (${Date.now() - issueStart}ms)`);
  }

  // Test publisher requests (30 req/min limit)
  console.log('\n   Publishers (30 req/min):');
  const publisherStart = Date.now();
  for (let i = 1; i <= 3; i++) {
    const publisher = await client.publisher.retrieve(i);
    console.log(
      `     ${i}. ${publisher.name} (${Date.now() - publisherStart}ms)`,
    );
  }

  // Check rate limit status
  console.log('\n2. Rate limit status:');
  const characterStatus = await client.getRateLimitStatus('characters');
  const issueStatus = await client.getRateLimitStatus('issues');
  const publisherStatus = await client.getRateLimitStatus('publishers');

  console.log(
    `   Characters: ${characterStatus?.remaining}/${characterStatus?.limit} remaining`,
  );
  console.log(
    `   Issues: ${issueStatus?.remaining}/${issueStatus?.limit} remaining`,
  );
  console.log(
    `   Publishers: ${publisherStatus?.remaining}/${publisherStatus?.limit} remaining`,
  );

  // Demonstrate rate limit enforcement
  console.log('\n3. Testing rate limit enforcement:');
  console.log('   Making rapid requests to trigger rate limiting...');

  const rapidStart = Date.now();
  const promises = [];

  // Make many rapid requests to trigger rate limiting
  for (let i = 1; i <= 10; i++) {
    promises.push(
      client.issue.retrieve(i).then((issue) => ({
        id: i,
        name: issue.name,
        time: Date.now() - rapidStart,
      })),
    );
  }

  const results = await Promise.all(promises);
  results.forEach((result, index) => {
    console.log(`   Request ${index + 1}: ${result.name} (${result.time}ms)`);
  });

  // Show final rate limit status
  console.log('\n4. Final rate limit status:');
  const finalIssueStatus = await client.getRateLimitStatus('issues');
  console.log(
    `   Issues: ${finalIssueStatus?.remaining}/${finalIssueStatus?.limit} remaining`,
  );
  console.log(
    `   Reset time: ${finalIssueStatus?.resetTime.toLocaleTimeString()}`,
  );
}

// Example of handling rate limit errors with throwOnRateLimit: true
async function demonstrateRateLimitErrors() {
  console.log('\n=== Rate Limit Error Handling Demo ===\n');

  // Create a client that throws on rate limit
  const strictClient = new ComicVine({
    apiKey: 'your-api-key-here',
    stores: {
      rateLimit: new InMemoryRateLimitStore({
        defaultConfig: { limit: 5, windowMs: 60000 }, // Very low limit for demo
      }),
    },
    client: {
      throwOnRateLimit: true, // Throw errors instead of waiting
    },
  });

  console.log('Making requests with throwOnRateLimit: true...');

  for (let i = 1; i <= 10; i++) {
    try {
      const issue = await strictClient.issue.retrieve(i);
      console.log(`✅ Request ${i}: ${issue.name}`);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Rate limit exceeded')
      ) {
        console.log(`❌ Request ${i}: Rate limit exceeded`);
        break; // Stop making requests
      } else {
        console.log(`❌ Request ${i}: Other error - ${error}`);
      }
    }
  }
}

// Example of custom rate limit configuration
async function demonstrateCustomRateLimit() {
  console.log('\n=== Custom Rate Limit Configuration Demo ===\n');

  // Create a client with very specific rate limits
  const customClient = new ComicVine({
    apiKey: 'your-api-key-here',
    stores: {
      rateLimit: new InMemoryRateLimitStore({
        defaultConfig: { limit: 10, windowMs: 10000 }, // 10 requests per 10 seconds
        resourceConfigs: new Map([
          ['volumes', { limit: 2, windowMs: 10000 }], // Very restrictive for volumes
          ['series', { limit: 20, windowMs: 10000 }], // More permissive for series
        ]),
      }),
    },
    client: {
      throwOnRateLimit: false,
      maxWaitTime: 15000, // 15 seconds max wait
    },
  });

  console.log('Testing custom rate limits:');

  // Test volume requests (2 req/10s)
  console.log('   Volumes (2 req/10s):');
  for (let i = 1; i <= 4; i++) {
    const start = Date.now();
    try {
      const volume = await customClient.volume.retrieve(i);
      console.log(`     ${i}. ${volume.name} (${Date.now() - start}ms)`);
    } catch (error) {
      console.log(`     ${i}. Error: ${error}`);
    }
  }
}

async function main() {
  try {
    await demonstrateRateLimiting();
    await demonstrateRateLimitErrors();
    await demonstrateCustomRateLimit();
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

main().catch(console.error);
