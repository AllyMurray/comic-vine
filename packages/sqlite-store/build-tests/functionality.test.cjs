/**
 * Test basic functionality of built artifacts
 * This file validates that the built package works as expected
 */
const { resolve } = require('path');

async function testFunctionality() {
  console.log('Testing sqlite-store basic functionality...');

  try {
    // Test CJS functionality
    const {
      SQLiteCacheStore,
      SQLiteDedupeStore,
      SQLiteRateLimitStore,
    } = require('../lib/index.cjs');

    // Create mock database that mimics better-sqlite3 interface
    const mockDb = {
      prepare: (sql) => ({
        run: () => ({ changes: 1 }),
        get: () => null,
        all: () => [],
        raw: () => ({
          all: () => [],
        }),
        finalize: () => {},
      }),
      exec: (sql) => {},
      close: () => {},
    };

    // Test SQLiteCacheStore
    const cacheStore = new SQLiteCacheStore({ database: mockDb });

    // Test that we can call methods without errors
    try {
      await cacheStore.set('test-key', 'test-value', 30000);
      await cacheStore.get('test-key');
      await cacheStore.delete('test-key');
      await cacheStore.clear();
    } catch (error) {
      throw new Error(`SQLiteCacheStore method calls failed: ${error.message}`);
    }

    // Test SQLiteDedupeStore
    const dedupeStore = new SQLiteDedupeStore({ database: mockDb });

    try {
      const jobId = await dedupeStore.register('test-hash');
      await dedupeStore.isInProgress('test-hash');
      await dedupeStore.complete('test-hash', 'test-result');
      await dedupeStore.waitFor('test-hash');
    } catch (error) {
      throw new Error(
        `SQLiteDedupeStore method calls failed: ${error.message}`,
      );
    }

    // Test SQLiteRateLimitStore
    const rateLimitStore = new SQLiteRateLimitStore({
      database: mockDb,
      defaultConfig: { limit: 10, windowMs: 60000 },
    });

    try {
      await rateLimitStore.canProceed('test-resource');
      await rateLimitStore.record('test-resource');
      await rateLimitStore.getStatus('test-resource');
      await rateLimitStore.reset('test-resource');
      await rateLimitStore.getWaitTime('test-resource');
    } catch (error) {
      throw new Error(
        `SQLiteRateLimitStore method calls failed: ${error.message}`,
      );
    }

    // Test that stores can be configured with different options
    const customCacheStore = new SQLiteCacheStore({
      database: mockDb,
      tableName: 'custom_cache',
      cleanupIntervalMs: 30000,
    });

    if (!customCacheStore) {
      throw new Error('Failed to create SQLiteCacheStore with custom options');
    }

    console.log('✅ sqlite-store functionality test passed');
    return true;
  } catch (error) {
    console.error('❌ sqlite-store functionality test failed:', error.message);
    return false;
  }
}

// Run the test
testFunctionality()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ sqlite-store functionality test crashed:', error);
    process.exit(1);
  });
