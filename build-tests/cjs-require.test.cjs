/**
 * Test CommonJS require from built artifacts
 * This file validates that the CJS build works correctly
 */
const { resolve } = require('path');

function testCJSRequire() {
  console.log('Testing CJS require...');

  try {
    // Test requiring the CJS build
    const ComicVine = require('../lib/index.cjs');

    if (typeof ComicVine !== 'function') {
      throw new Error('CJS export should be a constructor function');
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

    console.log('✅ CJS require test passed');
    return true;
  } catch (error) {
    console.error('❌ CJS require test failed:', error.message);
    return false;
  }
}

// Run the test
const success = testCJSRequire();
process.exit(success ? 0 : 1);
