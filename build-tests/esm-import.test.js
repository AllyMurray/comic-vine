/**
 * Test ESM imports from built artifacts
 * This file validates that the ESM build works correctly
 */
import { promises as fs } from 'fs';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

async function testESMImport() {
  console.log('Testing ESM imports...');

  try {
    // Test default import
    const { default: ComicVine } = await import('../lib/index.js');

    if (typeof ComicVine !== 'function') {
      throw new Error('Default export should be a constructor function');
    }

    // Test that we can create an instance
    const client = new ComicVine({ apiKey: 'test-key' });

    if (!client) {
      throw new Error('Failed to create ComicVine instance');
    }

    // Test that key resources are available
    const resources = ['character', 'issue', 'volume', 'publisher'];
    for (const resource of resources) {
      if (!client[resource]) {
        throw new Error(`Missing resource: ${resource}`);
      }

      if (typeof client[resource].list !== 'function') {
        throw new Error(`Resource ${resource} missing list method`);
      }

      if (typeof client[resource].retrieve !== 'function') {
        throw new Error(`Resource ${resource} missing retrieve method`);
      }
    }

    console.log('✅ ESM import test passed');
    return true;
  } catch (error) {
    console.error('❌ ESM import test failed:', error.message);
    return false;
  }
}

// Run the test
testESMImport()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ ESM import test crashed:', error);
    process.exit(1);
  });
