import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'tsdown';

// Keep the explicit TS7 native compiler used for declaration generation.
const require = createRequire(import.meta.url);
const nativePackage = dirname(
  require.resolve('@typescript/native/package.json'),
);
const { default: getExePath } = require(
  join(nativePackage, 'lib/getExePath.js'),
);

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: { generator: 'tsgo', tsgo: { path: getExePath() } },
  sourcemap: true,
  clean: true,
  outDir: 'lib',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  // Preserve the existing browser syntax target rather than inferring engines.node.
  target: 'es2015',
  deps: { resolveDepSubpath: true, neverBundle: true },
  tsconfig: './tsconfig.json',
});
