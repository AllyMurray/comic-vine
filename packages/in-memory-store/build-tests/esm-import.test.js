/**
 * Test ESM imports from built artifacts
 * This file validates that the ESM build works correctly
 */
import { promises as fs } from 'fs';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

async function testESMImport() {
  console.log('Testing in-memory-store ESM imports...');

  try {
    // Test named imports
    const { InMemoryCacheStore, InMemoryDedupeStore, InMemoryRateLimitStore } =
      await import('../lib/index.js');

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

    console.log('✅ in-memory-store ESM import test passed');
    return true;
  } catch (error) {
    console.error('❌ in-memory-store ESM import test failed:', error.message);
    return false;
  }
}

// Run the test
testESMImport()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ in-memory-store ESM import test crashed:', error);
    process.exit(1);
  });
