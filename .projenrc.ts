import { TypeScriptNpmPackage } from '@ally-murray/projen-modules';

const project = new TypeScriptNpmPackage({
  name: 'comic-vine',
  packageName: 'comic-vine-sdk',
  description: 'A JS/TS client for the Comic Vine API',
  defaultReleaseBranch: 'main',
  minMajorVersion: 1,
  minNodeVersion: '18.0.0',
  repository: 'https://github.com/AllyMurray/comic-vine',
  deps: ['axios', 'zod'],
  devDeps: [
    '@ally-murray/projen-modules',
    'commitizen',
    'husky',
    'lint-staged',
    'nock',
    'rimraf',
  ],
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

project.synth();
