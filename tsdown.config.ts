import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'tsdown';

// ESLint resolves `typescript` to the TS6 compatibility API. Resolve the native
// executable from our TS7 alias explicitly, using the same helper as the DTS plugin.
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
  deps: { neverBundle: true },
  tsconfig: './tsconfig.json',
});
