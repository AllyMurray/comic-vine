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
  ],
  projenrcTs: true,
  gitignore: ['.DS_Store', '*yalc*'],
  jestOptions: {
    jestConfig: {
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    },
  },

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

project.synth();

// TODO: Sort out version number
