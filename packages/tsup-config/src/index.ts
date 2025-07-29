import type { Options } from 'tsup';

export const sharedTsupConfig = {
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'lib',
  treeshake: true,
  minify: false,
  target: 'es2015' as const,
  tsconfig: './tsconfig.json',
  cjsInterop: true,
  skipNodeModulesBundle: true,
} satisfies Options;
