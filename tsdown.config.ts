import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  // Resolve the native TS7 compiler from the standard typescript package name.
  dts: { generator: 'tsgo' },
  sourcemap: true,
  clean: true,
  outDir: 'lib',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  // Preserve the existing browser syntax target rather than inferring engines.node.
  target: 'es2015',
  deps: { resolveDepSubpath: true, neverBundle: true },
  tsconfig: './tsconfig.json',
});
