/**
 * Test CommonJS require from built artifacts
 * This file validates that the CJS build works correctly
 */
const { resolve } = require('path');

function testCJSRequire() {
  console.log('Testing in-memory-store CJS require...');

  try {
    // Test requiring the CJS build
    const {
      InMemoryCacheStore,
      InMemoryDedupeStore,
      InMemoryRateLimitStore,
    } = require('../lib/index.cjs');

    if (typeof InMemoryCacheStore !== 'function') {
      throw new Error('InMemoryCacheStore should be a constructor function');
    }

    if (typeof InMemoryDedupeStore !== 'function') {
      throw new Error('InMemoryDedupeStore should be a constructor function');
    }

    if (typeof InMemoryRateLimitStore !== 'function') {
      throw new Error(
        'InMemoryRateLimitStore should be a constructor function',
      );
    }

    // Test that we can create instances
    const cacheStore = new InMemoryCacheStore();
    const dedupeStore = new InMemoryDedupeStore();
    const rateLimitStore = new InMemoryRateLimitStore();

    if (!cacheStore || !dedupeStore || !rateLimitStore) {
      throw new Error('Failed to create store instances');
    }

    // Test that stores have required methods
    const cacheStoreMethods = ['get', 'set', 'delete', 'clear'];
    for (const method of cacheStoreMethods) {
      if (typeof cacheStore[method] !== 'function') {
        throw new Error(`InMemoryCacheStore missing method: ${method}`);
      }
    }

    const dedupeStoreMethods = [
      'waitFor',
      'register',
      'complete',
      'fail',
      'isInProgress',
    ];
    for (const method of dedupeStoreMethods) {
      if (typeof dedupeStore[method] !== 'function') {
        throw new Error(`InMemoryDedupeStore missing method: ${method}`);
      }
    }

    const rateLimitStoreMethods = [
      'canProceed',
      'record',
      'getStatus',
      'reset',
      'getWaitTime',
    ];
    for (const method of rateLimitStoreMethods) {
      if (typeof rateLimitStore[method] !== 'function') {
        throw new Error(`InMemoryRateLimitStore missing method: ${method}`);
      }
    }

    console.log('✅ in-memory-store CJS require test passed');
    return true;
  } catch (error) {
    console.error('❌ in-memory-store CJS require test failed:', error.message);
    return false;
  }
}

// Run the test
const success = testCJSRequire();
process.exit(success ? 0 : 1);
