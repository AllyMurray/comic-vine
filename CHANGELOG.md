# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.8] - 2024-01-01

### Changed

- Migrated from Projen to standard npm project structure
- Updated GitHub Actions workflows to use artifact actions v4
- Improved build process and release workflow

## [1.2.5](https://github.com/AllyMurray/comic-vine/compare/v1.2.4...v1.2.5) (2023-03-18)

### Bug Fixes

- upgrade zod from 3.20.2 to 3.20.5 ([31755e7](https://github.com/AllyMurray/comic-vine/commit/31755e711b7a61fced6da6554461b45f4db43046))
- upgrade zod from 3.20.5 to 3.20.6 ([4c32d5b](https://github.com/AllyMurray/comic-vine/commit/4c32d5b8f8d94da50a1a4c456f360dbe9d53beaf))

## [1.2.4](https://github.com/AllyMurray/comic-vine/compare/v1.2.3...v1.2.4) (2023-01-31)

### Bug Fixes

- :package: publish typings to npm ([f132dd6](https://github.com/AllyMurray/comic-vine/commit/f132dd6e3d8a2983e5e8b20434c6d491123503e4))

## [1.2.3](https://github.com/AllyMurray/comic-vine/compare/v1.2.2...v1.2.3) (2023-01-22)

### Bug Fixes

- upgrade zod from 3.19.1 to 3.20.2 ([4576f78](https://github.com/AllyMurray/comic-vine/commit/4576f78a34a5470274da2d384814bf8f85e977fe))

## [1.2.2](https://github.com/AllyMurray/comic-vine/compare/v1.2.1...v1.2.2) (2022-12-04)

### Bug Fixes

- **typo in pagination example:** typo in pagination example ([3b3d3c5](https://github.com/AllyMurray/comic-vine/commit/3b3d3c5b30ce42672767f1a17d78b792a6dc3a0f))

## [1.2.1](https://github.com/AllyMurray/comic-vine/compare/v1.2.0...v1.2.1) (2022-12-04)

### Bug Fixes

- **auto pagination example:** fixes the autopagination example so limit is set to 50 ([a198408](https://github.com/AllyMurray/comic-vine/commit/a19840857a67c71f8cd671f47335b8c7a6f28f4d))

# [1.2.0](https://github.com/AllyMurray/comic-vine/compare/v1.1.1...v1.2.0) (2022-12-04)

### Features

- **auto pagination:** add auto pagination to list methods ([a5fa379](https://github.com/AllyMurray/comic-vine/commit/a5fa379e9cc267552741aa5f82c06b8242f55856))

## [1.1.1](https://github.com/AllyMurray/comic-vine/compare/v1.1.0...v1.1.1) (2022-10-15)

### Bug Fixes

- **options docs:** add missing documentation for setting baseUrl ([6954695](https://github.com/AllyMurray/comic-vine/commit/6954695b6d3322fde38258fcc1f50fc6a83aa72e))

# [1.1.0](https://github.com/AllyMurray/comic-vine/compare/v1.0.4...v1.1.0) (2022-10-15)

### Features

- **library options:** allow setting baseUrl when initializing the library ([07fe7e3](https://github.com/AllyMurray/comic-vine/commit/07fe7e3905bea006b8a15dc0b545a0ae1f53f084))

## [1.0.4](https://github.com/AllyMurray/comic-vine/compare/v1.0.3...v1.0.4) (2022-10-08)

### Bug Fixes

- **typings:** improve the api response typings ([e5bf556](https://github.com/AllyMurray/comic-vine/commit/e5bf5561149e1cff6e0c538dacf3c8fc71b6c935))

## [1.0.3](https://github.com/AllyMurray/comic-vine/compare/v1.0.2...v1.0.3) (2022-10-07)

### Bug Fixes

- **tsconfig.json:** remove comments so that the file can be parsed by snyk ([fe715f7](https://github.com/AllyMurray/comic-vine/commit/fe715f72840bce8247c0550c21fa45d555b7990f))

## [1.0.2](https://github.com/AllyMurray/comic-vine/compare/v1.0.1...v1.0.2) (2022-10-07)

### Bug Fixes

- **character details typings:** birth can be null or string, change any arrays to SiteResource array ([5a69bd3](https://github.com/AllyMurray/comic-vine/commit/5a69bd3b6394b2a389cdf7c5b9b4713350788fb8))

## [1.0.1](https://github.com/AllyMurray/comic-vine/compare/v1.0.0...v1.0.1) (2022-10-05)

### Bug Fixes

- **ts build:** update typescript typings to remove false positives in vscode problems window ([ece4080](https://github.com/AllyMurray/comic-vine/commit/ece4080370be2635712b1978f2e6d7f6c88ddc40))

# [1.0.0](https://github.com/AllyMurray/comic-vine/compare/efa0a077ec5104451fc33ab773d888bb79f6438f...v1.0.0) (2022-09-30)

### Bug Fixes

- **npm publish:** rename npm package ([37eb3a1](https://github.com/AllyMurray/comic-vine/commit/37eb3a17b9b8cd1c58e09b2efcb1380e10124d14))
- **npm publish:** rename npm package to comic-vine-sdk ([26fe0d8](https://github.com/AllyMurray/comic-vine/commit/26fe0d8321c7ed4df57664e5006a798e296b17dc))

### Features

- **gh workflow:** automate release to npm ([efa0a07](https://github.com/AllyMurray/comic-vine/commit/efa0a077ec5104451fc33ab773d888bb79f6438f))
