import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: {
    entry: 'src/index.ts',
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'lib',
  treeshake: true,
  minify: false,
  target: 'es2015',
  tsconfig: './tsconfig.json',
  cjsInterop: true,
  skipNodeModulesBundle: true,
});
