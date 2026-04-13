/**
 * Test browser bundleability of built artifacts
 * This file validates that the ESM build can be bundled for browsers
 * using esbuild, catching Node-specific API usage and unresolvable imports
 */
import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read package.json dependencies so we can externalize them.
// The SDK ships as a library — consumers bundle deps themselves.
// This test validates that *our* code introduces no Node-specific APIs.
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf8'),
);
const external = Object.keys(pkg.dependencies || {});

async function testBrowserBundle() {
  console.log('Testing browser bundleability...');

  try {
    const result = await build({
      entryPoints: [resolve(__dirname, '../lib/index.js')],
      bundle: true,
      platform: 'browser',
      format: 'iife',
      write: false,
      logLevel: 'silent',
      external,
    });

    if (!result.outputFiles || result.outputFiles.length === 0) {
      throw new Error('esbuild produced no output');
    }

    if (result.errors.length > 0) {
      throw new Error(
        `esbuild errors: ${result.errors.map((e) => e.text).join(', ')}`,
      );
    }

    console.log(
      `  Bundle size: ${(result.outputFiles[0].contents.length / 1024).toFixed(1)} KB`,
    );
    console.log('✅ Browser bundle test passed');
    return true;
  } catch (error) {
    console.error('❌ Browser bundle test failed:', error.message);
    return false;
  }
}

testBrowserBundle()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Browser bundle test crashed:', error);
    process.exit(1);
  });
