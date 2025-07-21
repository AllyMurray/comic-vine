/**
 * Test ESM imports from built artifacts
 * This file validates that the ESM build works correctly
 */
import { promises as fs } from 'fs';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

async function testESMImport() {
  console.log('Testing sqlite-store ESM imports...');

  try {
    // Test named imports
    const { SQLiteCacheStore, SQLiteDedupeStore, SQLiteRateLimitStore } =
      await import('../lib/index.js');

    if (typeof SQLiteCacheStore !== 'function') {
      throw new Error('SQLiteCacheStore should be a constructor function');
    }

    if (typeof SQLiteDedupeStore !== 'function') {
      throw new Error('SQLiteDedupeStore should be a constructor function');
    }

    if (typeof SQLiteRateLimitStore !== 'function') {
      throw new Error('SQLiteRateLimitStore should be a constructor function');
    }

    // Test that we can create instances (with mock database)
    const mockDb = {
      prepare: () => ({
        run: () => {},
        get: () => null,
        all: () => [],
        finalize: () => {},
      }),
      exec: () => {},
      close: () => {},
    };

    const cacheStore = new SQLiteCacheStore({ database: mockDb });
    const dedupeStore = new SQLiteDedupeStore({ database: mockDb });
    const rateLimitStore = new SQLiteRateLimitStore({ database: mockDb });

    if (!cacheStore || !dedupeStore || !rateLimitStore) {
      throw new Error('Failed to create store instances');
    }

    // Test that stores have required methods
    const cacheStoreMethods = ['get', 'set', 'delete', 'clear'];
    for (const method of cacheStoreMethods) {
      if (typeof cacheStore[method] !== 'function') {
        throw new Error(`SQLiteCacheStore missing method: ${method}`);
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
        throw new Error(`SQLiteDedupeStore missing method: ${method}`);
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
        throw new Error(`SQLiteRateLimitStore missing method: ${method}`);
      }
    }

    console.log('✅ sqlite-store ESM import test passed');
    return true;
  } catch (error) {
    console.error('❌ sqlite-store ESM import test failed:', error.message);
    return false;
  }
}

// Run the test
testESMImport()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ sqlite-store ESM import test crashed:', error);
    process.exit(1);
  });
