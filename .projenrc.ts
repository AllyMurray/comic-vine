import { TypeScriptNpmPackage } from '@ally-murray/projen-modules';

const repository = 'https://github.com/AllyMurray/comic-vine';

const project = new TypeScriptNpmPackage({
  name: 'comic-vine',
  packageName: 'comic-vine-sdk',
  description: 'A JS/TS client for the Comic Vine API',
  defaultReleaseBranch: 'main',
  deps: ['axios', 'clone-deep', 'zod'],
  devDeps: [
    '@ally-murray/projen-modules',
    '@types/clone-deep',
    'commitizen',
    'husky',
    'lint-staged',
    'nock',
    'rimraf',
    'vitest',
  ],
  minMajorVersion: 1,
  keywords: [
    'comic-metadata',
    'comic-vine-api',
    'comic-vine-client',
    'comic-vine-javascript',
    'comic-vine-js',
    'comic-vine-node',
    'comic-vine-nodejs',
    'comic-vine-sdk',
    'comic-vine-ts',
    'comic-vine-typescript',
    'comic-vine',
    'comic',
    'comics',
    'metadata',
  ],
  repository,
  tsconfig: {
    compilerOptions: {
      module: 'Node16',
      target: 'ES2020',
      // @ts-expect-error types is missing from compilerOptions
      types: ['vitest/globals'],
      skipLibCheck: true,
    },
  },
});

project.synth();
