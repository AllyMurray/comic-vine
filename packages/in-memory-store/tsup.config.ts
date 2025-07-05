import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
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
