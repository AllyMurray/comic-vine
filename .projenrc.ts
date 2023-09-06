import { TypeScriptNpmPackage } from '@ally-murray/projen-modules';

const repository = 'https://github.com/AllyMurray/comic-vine';

const project = new TypeScriptNpmPackage({
  name: 'comic-vine',
  packageName: 'comic-vine-sdk',
  description: 'A JS/TS client for the Comic Vine API',
  authorName: 'Ally Murray',
  authorEmail: 'allymurray88@gmail.com',
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
  projenrcTs: true,
  tsconfig: {
    compilerOptions: {
      module: 'Node16',
      target: 'ES2020',
      // @ts-expect-error types is missing from compilerOptions
      types: ['vitest/globals'],
      skipLibCheck: true,
    },
  },
  gitignore: ['.DS_Store', '*yalc*', 'test-reports'],
  jest: false,
  repository: `${repository}.git`,
  bugsUrl: `${repository}/issues`,
  homepage: `${repository}#readme`,
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
});

project.npmrc.addConfig('save-exact', 'true');

project.testTask.prependExec('vitest --dir=src', { receiveArgs: true });

project.eslint?.addOverride({
  files: ['*.test.ts'],
  rules: {
    'dot-notation': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: true,
      },
    ],
  },
});

project.synth();

// TODO: Sort out version number
