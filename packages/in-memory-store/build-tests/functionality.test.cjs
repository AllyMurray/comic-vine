/**
 * Test basic functionality of built artifacts
 * This file validates that the built package works as expected
 */
const { resolve } = require('path');

async function testFunctionality() {
  console.log('Testing in-memory-store basic functionality...');

  try {
    // Test CJS functionality
    const {
      InMemoryCacheStore,
      InMemoryDedupeStore,
      InMemoryRateLimitStore,
    } = require('../lib/index.cjs');

    // Test InMemoryCacheStore
    const cacheStore = new InMemoryCacheStore({ maxSize: 100, ttl: 60000 });
    await cacheStore.set('test-key', 'test-value', 30000);
    const cachedValue = await cacheStore.get('test-key');

    if (cachedValue !== 'test-value') {
      throw new Error('InMemoryCacheStore set/get failed');
    }

    // Test InMemoryDedupeStore
    const dedupeStore = new InMemoryDedupeStore({ jobTimeoutMs: 60000 });
    const jobId = await dedupeStore.register('test-hash');

    if (!jobId) {
      throw new Error('InMemoryDedupeStore register failed');
    }

    const isInProgress = await dedupeStore.isInProgress('test-hash');
    if (!isInProgress) {
      throw new Error(
        'InMemoryDedupeStore isInProgress should return true for registered job',
      );
    }

    await dedupeStore.complete('test-hash', 'test-result');
    const result = await dedupeStore.waitFor('test-hash');

    if (result !== 'test-result') {
      throw new Error('InMemoryDedupeStore complete/waitFor failed');
    }

    // Test InMemoryRateLimitStore
    const rateLimitStore = new InMemoryRateLimitStore({
      defaultConfig: { limit: 10, windowMs: 60000 },
    });

    const canProceed = await rateLimitStore.canProceed('test-resource');
    if (!canProceed) {
      throw new Error('InMemoryRateLimitStore should allow first request');
    }

    await rateLimitStore.record('test-resource');
    const status = await rateLimitStore.getStatus('test-resource');

    if (!status || status.remaining !== 9) {
      throw new Error('InMemoryRateLimitStore record/getStatus failed');
    }

    // Test that stores can be configured with different options
    const customCacheStore = new InMemoryCacheStore({
      maxItems: 500,
      maxMemoryBytes: 10 * 1024 * 1024, // 10MB
      cleanupIntervalMs: 30000,
    });

    if (!customCacheStore) {
      throw new Error(
        'Failed to create InMemoryCacheStore with custom options',
      );
    }

    console.log('✅ in-memory-store functionality test passed');
    return true;
  } catch (error) {
    console.error(
      '❌ in-memory-store functionality test failed:',
      error.message,
    );
    return false;
  }
}

// Run the test
testFunctionality()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ in-memory-store functionality test crashed:', error);
    process.exit(1);
  });
