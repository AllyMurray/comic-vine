import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vitePlusPath = require.resolve('vite-plus/package.json');
const vitePlus = require(vitePlusPath);
const core = require('vite/package.json');
const bundledRequire = createRequire(vitePlusPath);
const vitest = bundledRequire('vitest/package.json');

assert.equal(core.name, '@voidzero-dev/vite-plus-core');
assert.equal(
  core.version,
  vitePlus.version,
  'Update the vite-plus and vite catalog entries together.',
);
assert.equal(
  vitest.version,
  vitePlus.dependencies.vitest,
  'Use the exact Vitest version bundled by Vite+; remove independent overrides.',
);

console.log(
  `Vite+ ${vitePlus.version}, matching core, Vitest ${vitest.version}`,
);
