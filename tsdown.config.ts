import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'lib',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  // Preserve the existing browser syntax target rather than inferring engines.node.
  target: 'es2015',
  deps: { neverBundle: true },
  tsconfig: './tsconfig.json',
});
