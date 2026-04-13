/**
 * Test basic functionality of built artifacts
 * This file validates that the built package works as expected.
 * Enhanced with patterns from comic-vine-playground to test all 19 resources.
 */

async function testFunctionality() {
  console.log('Testing basic functionality...');

  try {
    // Test CJS functionality
    const ComicVine = require('../lib/index.cjs');
    const client = new ComicVine({ apiKey: 'test-key' });

    // All 19 resources that should be available
    const allResources = [
      'character',
      'concept',
      'episode',
      'issue',
      'location',
      'movie',
      'origin',
      'person',
      'power',
      'promo',
      'publisher',
      'series',
      'storyArc',
      'team',
      'thing',
      'video',
      'videoCategory',
      'videoType',
      'volume',
    ];

    // Test that all resources exist
    for (const resource of allResources) {
      if (!client[resource]) {
        throw new Error(`Client missing resource property: ${resource}`);
      }
    }

    // Test that all resources have list and retrieve methods
    const methods = ['list', 'retrieve'];
    for (const resource of allResources) {
      for (const method of methods) {
        if (typeof client[resource][method] !== 'function') {
          throw new Error(`Resource ${resource} missing method ${method}`);
        }
      }
    }

    // Test client construction with various option combinations
    const clientWithBaseUrl = new ComicVine({
      apiKey: 'test-key',
      baseUrl: 'https://custom.api.com/',
    });
    if (!clientWithBaseUrl) {
      throw new Error('Failed to create client with custom baseUrl');
    }

    const clientWithStores = new ComicVine({
      apiKey: 'test-key',
      stores: {
        cache: {
          get: () => {},
          set: () => {},
          delete: () => {},
          clear: () => {},
        },
      },
    });
    if (!clientWithStores) {
      throw new Error('Failed to create client with stores');
    }

    const clientWithOptions = new ComicVine({
      apiKey: 'test-key',
      client: {
        defaultCacheTTL: 300,
        throwOnRateLimit: false,
        maxWaitTime: 30000,
      },
    });
    if (!clientWithOptions) {
      throw new Error('Failed to create client with client options');
    }

    const clientFull = new ComicVine({
      apiKey: 'test-key',
      baseUrl: 'https://custom.api.com/',
      stores: {
        cache: {
          get: () => {},
          set: () => {},
          delete: () => {},
          clear: () => {},
        },
      },
      client: {
        defaultCacheTTL: 7200,
        throwOnRateLimit: false,
        maxWaitTime: 30000,
      },
    });
    if (!clientFull) {
      throw new Error('Failed to create client with all options');
    }

    // Verify resource count
    if (allResources.length !== 19) {
      throw new Error(`Expected 19 resources but found ${allResources.length}`);
    }

    console.log(
      `✅ Functionality test passed (${allResources.length} resources verified)`,
    );
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
