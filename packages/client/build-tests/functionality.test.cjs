/**
 * Test basic functionality of built artifacts
 * This file validates that the built package works as expected
 */
const { resolve } = require('path');

async function testFunctionality() {
  console.log('Testing basic functionality...');

  try {
    // Test CJS functionality
    const ComicVine = require('../lib/index.cjs');
    const client = new ComicVine({ apiKey: 'test-key' });

    // Test that client has expected structure
    if (
      !client.character ||
      !client.issue ||
      !client.volume ||
      !client.publisher
    ) {
      throw new Error('Client missing expected resource properties');
    }

    // Test that resources have expected methods
    const methods = ['list', 'retrieve'];
    const resources = ['character', 'issue', 'volume', 'publisher'];

    for (const resource of resources) {
      for (const method of methods) {
        if (typeof client[resource][method] !== 'function') {
          throw new Error(`Resource ${resource} missing method ${method}`);
        }
      }
    }

    // Test that client can be constructed with different options
    const clientWithOptions = new ComicVine({
      apiKey: 'test-key',
      baseUrl: 'https://custom.api.com',
      client: {
        defaultCacheTTL: 300,
        throwOnRateLimit: false,
        maxWaitTime: 30000,
      },
    });

    if (!clientWithOptions) {
      throw new Error('Failed to create client with custom options');
    }

    console.log('✅ Functionality test passed');
    return true;
  } catch (error) {
    console.error('❌ Functionality test failed:', error.message);
    return false;
  }
}

// Run the test
testFunctionality()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Functionality test crashed:', error);
    process.exit(1);
  });
