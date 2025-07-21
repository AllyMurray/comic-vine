/**
 * Test package.json exports mapping
 * This file validates that the exports field works correctly
 */
const { resolve } = require('path');
const { readFileSync, existsSync } = require('fs');

function testExports() {
  console.log('Testing sqlite-store package.json exports...');

  try {
    // Read package.json
    const packagePath = resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

    if (!packageJson.exports) {
      throw new Error('package.json missing exports field');
    }

    const exports = packageJson.exports['.'];
    if (!exports) {
      throw new Error('package.json missing root export');
    }

    // Check import export
    if (!exports.import) {
      throw new Error('package.json missing import export');
    }

    const importDefault = exports.import.default;
    const importTypes = exports.import.types;

    if (!importDefault || !importTypes) {
      throw new Error('package.json import export missing default or types');
    }

    // Check files exist
    const importDefaultPath = resolve(__dirname, '..', importDefault);
    const importTypesPath = resolve(__dirname, '..', importTypes);

    if (!existsSync(importDefaultPath)) {
      throw new Error(`Import default file does not exist: ${importDefault}`);
    }

    if (!existsSync(importTypesPath)) {
      throw new Error(`Import types file does not exist: ${importTypes}`);
    }

    // Check require export
    if (!exports.require) {
      throw new Error('package.json missing require export');
    }

    const requireDefault = exports.require.default;
    const requireTypes = exports.require.types;

    if (!requireDefault || !requireTypes) {
      throw new Error('package.json require export missing default or types');
    }

    // Check files exist
    const requireDefaultPath = resolve(__dirname, '..', requireDefault);
    const requireTypesPath = resolve(__dirname, '..', requireTypes);

    if (!existsSync(requireDefaultPath)) {
      throw new Error(`Require default file does not exist: ${requireDefault}`);
    }

    if (!existsSync(requireTypesPath)) {
      throw new Error(`Require types file does not exist: ${requireTypes}`);
    }

    // Check that main, module, and types fields align
    if (packageJson.main !== requireDefault) {
      throw new Error('package.json main field should match require.default');
    }

    if (packageJson.module !== importDefault) {
      throw new Error('package.json module field should match import.default');
    }

    if (packageJson.types !== importTypes) {
      throw new Error('package.json types field should match import.types');
    }

    console.log('✅ sqlite-store exports validation test passed');
    return true;
  } catch (error) {
    console.error(
      '❌ sqlite-store exports validation test failed:',
      error.message,
    );
    return false;
  }
}

// Run the test
const success = testExports();
process.exit(success ? 0 : 1);
