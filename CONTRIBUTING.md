# Contributing to Comic Vine SDK

Thank you for your interest in contributing to the Comic Vine SDK! This document provides guidelines and information to help you contribute effectively to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Dependency Updates](#dependency-updates)
- [Submitting Changes](#submitting-changes)
- [Project Structure](#project-structure)
- [Resources](#resources)

## Code of Conduct

This project adheres to a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [allymurray88@gmail.com](mailto:allymurray88@gmail.com).

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Node 24 LTS, version 24.11.0 or higher, for development and builds.
  The published package continues to support Node 22 and 24.
- **pnpm**: Use the version pinned in `package.json` (currently 12.4.2).
  ```bash
  npm install -g pnpm@12.4.2
  ```

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/comic-vine.git
   cd comic-vine
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Verify Setup**
   ```bash
   pnpm test
   ```

If all tests pass, you're ready to start developing!

## Development Workflow

### Creating a Branch

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. Use descriptive branch names:
   - `feature/add-search-pagination`
   - `fix/handle-rate-limiting`
   - `docs/update-readme-examples`

### Making Changes

1. **Write Code**: Follow the [Code Standards](#code-standards) below
2. **Add Tests**: Ensure new functionality has corresponding tests
3. **Validate**: `pnpm lint && pnpm typecheck && pnpm test`
4. **Build**: `pnpm build` to ensure your changes compile correctly

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(resources): add pagination support to character list
fix(http-client): handle network timeout errors
docs(readme): update installation instructions
```

## Code Standards

### TypeScript Guidelines

- **Type Safety**: Prefer explicit types over `any`
- **Interfaces**: Use interfaces for object shapes
- **Generics**: Leverage generics for reusable components
- **Strict Mode**: The project uses strict TypeScript settings

### Code Style

The library uses project-local **Vite+**: Oxlint for linting and type-aware checks,
and Oxfmt for formatting. Configuration lives in `vite.config.ts`. Keep using
pnpm; a global Vite+ installation or runtime manager is not required.

```bash
# Check source formatting, lint rules and types
pnpm lint

# Apply formatting and available lint fixes to source
pnpm lint:fix

# Format TypeScript and Markdown
pnpm format
```

**Key Style Rules:**

- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Prefer `const` over `let` when possible
- Use meaningful variable names
- Add JSDoc comments for public APIs

### Import Organization

Imports should be organized as follows:

```typescript
// 1. Built-in Node.js modules
import { readFile } from 'fs/promises';

// 2. External dependencies
import axios from 'axios';
import { z } from 'zod';

// 3. Internal modules (ordered alphabetically)
import { BaseResource } from './base-resource';
import { HttpClient } from './http-client';
```

## Testing

### Running Tests

```bash
# Run unit tests
pnpm test

# Check formatting, lint and types
pnpm lint

# Run tests in watch mode
pnpm test:watch
```

### Writing Tests

1. **Location**: Place test files alongside source files with `.test.ts` extension
2. **Naming**: Use descriptive test names that explain the behavior being tested
3. **Structure**: Follow Arrange-Act-Assert pattern

**Example Test:**

```typescript
import { describe, test, expect } from 'vite-plus/test';

describe('ResourceName', () => {
  test('should return correct data when field list is specified', async () => {
    // Arrange
    const expectedFields = ['id', 'name'];

    // Act
    const result = await resource.retrieve(123, { fieldList: expectedFields });

    // Assert
    expect(Object.keys(result)).toEqual(expectedFields);
  });
});
```

### Test Coverage

- Write tests for all new functionality
- Include both success and error scenarios
- Mock external dependencies using **nock** for HTTP requests
- Test files are located in `src/__mocks__/` for mock data

## Dependency Updates

[renovate.json](./renovate.json) manages the library, the documentation site's
separate pnpm project, and GitHub Actions. Both projects commit `pnpm-lock.yaml`
and pin pnpm in `packageManager`; use that version when updating dependencies.
The TypeScript library supports Node 22 and 24 and is published publicly as
`comic-vine-sdk` through the existing Changesets release workflow. Dropping a
supported Node major is recorded in a major Changeset. Its runtime
dependencies are `@http-client-toolkit/core` and `zod`; it currently has no peer
or optional dependencies.

Normal updates are scheduled every night between 00:00 and 06:00 in
`Europe/London`, with at most five open PRs and two new PRs per hour. Actual runs
depend on the Renovate service. Existing PRs can be rebased outside that window
so CI can run against the current `main`. The Dependency Dashboard lists pending
updates, and PRs use the existing `dependencies` label.

Both pnpm projects set `minimumReleaseAge: 1440` in their own
`pnpm-workspace.yaml`. New direct and transitive registry dependency versions
must be at least 24 hours old before pnpm selects them. There are no package
exemptions. `minimumReleaseAgeStrict: true` rejects a requested range with no
eligible release, and `minimumReleaseAgeIgnoreMissingTime: false` rejects missing
publication dates. pnpm 12 also checks the existing lockfile against these
policies during installs, including frozen installs. The library
and docs site retain separate installs and lockfiles. Build-script allowlists
and dependency overrides also live in these pnpm configuration files.
Build permissions use pnpm 12's `allowBuilds` map; unreviewed dependency scripts
are not approved automatically. The library's `saveExact: true` setting lives
here as well. No repository `.npmrc` is needed.

Renovate waits one day before proposing ordinary npm updates, and keeps the
longer three-day delay for patch auto-merge candidates. These delays provide
time for compromised releases to be detected; they do not establish that a
package is safe.

Related lint/formatting, testing, TypeScript/build and `@types/*` updates are
grouped. Patch and minor PRs are separated only for stable development tools
eligible for patch auto-merge; manually reviewed groups combine non-major
updates to reduce duplicate PRs. GitHub Actions updates, including major upgrades,
share one manually reviewed PR. Their grouping rule follows the general major
rule so that Actions majors stay together.
Non-major updates to `@http-client-toolkit/core` and
`@http-client-toolkit/store-memory` are grouped and always reviewed manually.
`size-limit` and `@size-limit/file` update together because the plugin requires
a matching `size-limit` version. Its coordinated major upgrades require manual
review and stay separate from
non-major updates. Vite+ and its matching Vite core alias are another deliberate
exception: they always update together in one manually reviewed PR, including
major upgrades. Other npm major upgrades remain separate.

Only stable patch updates to the explicitly listed development tools qualify
for auto-merge, after a three-day release age and successful CI. Renovate merges
PRs itself (`platformAutomerge: false`, `ignoreTests: false`) and rebases stale
branches before merging. Failed or pending checks, conflicts and Renovate
artifact errors prevent automatic merging. Runtime/optional dependencies,
compiler/build tools, type definitions, release tooling, package-manager
updates, Actions, pre-1.0 packages, minors and majors require manual review.
Runtime updates and auto-merge candidates are filtered against the package's
Node engine requirements when the dependency supplies engine metadata.
Review release notes and any compatibility warnings before merging manual PRs.

`@types/node` is kept on major 24 to match the Node 24 LTS build/release
runtime. Renovate may update it within 24.x but cannot move it to another
major. When changing the build/release Node major, update the type dependency
and its Renovate `allowedVersions` rule together. CI also tests compatibility
with the other Node majors declared in `engines.node`.

Future peer dependency updates use `rangeStrategy: widen` and always require
manual review. Check that consumers using existing supported versions still
work, test any newly added support, and retain old ranges where appropriate.
Do not copy a development dependency's version directly into a peer constraint.
Node engine changes are maintained manually because they change consumer support.

Security PRs bypass Renovate's nightly schedule, release-age delay and normal PR limits
and are raised as soon as Renovate processes an available vulnerability alert.
They still require review and passing CI. pnpm's 24-hour resolution delay also
applies to security fixes, so a newly published fix may need to age before
Renovate can successfully update its lockfile. See Renovate's
[vulnerability alert prerequisites](https://docs.renovatebot.com/configuration-options/#vulnerabilityalerts).

### GitHub setup

After merging the configuration, install or enable the
[Mend Renovate GitHub App](https://github.com/apps/renovate) for this repository
and allow it to create branches, PRs and the Dependency Dashboard issue. Enable
the dependency graph and Dependabot alerts, and grant Renovate read access to
those alerts for immediate security PRs. This does not require a separate
Renovate Actions workflow or a repository token secret.

Configure the `main` ruleset to require `validate (22.x)`,
`validate (24.x)` and `docs`, with branches up to date before merging. The
existing ruleset was inspected during setup and only prevented deletion and
force pushes; repository configuration files do not change those GitHub settings.
GitHub's "Allow auto-merge" setting is not needed for Renovate-managed merging.
Avoid granting Renovate a bypass of required checks. The legacy Mergify rule
references a `build` status and is not used by this Renovate policy.

### Build tooling

`pnpm build` checks toolchain alignment, then uses Vite+ (`vp pack`, powered by
tsdown) for the ESM bundle and bundled TypeScript declarations,
then esbuild for the existing CommonJS wrapper. The wrapper preserves the
callable constructor returned by `require('comic-vine-sdk')` and its named
exports. Both bundles retain the ES2015 syntax target and external runtime
dependencies.

TypeScript 7 performs source typechecking (`pnpm typecheck`) and declaration
emission through tsdown's `tsgo` generator. The native compiler is pinned via
`@typescript/native` (`npm:typescript@7.0.2`). The `typescript` dependency aliases
`@typescript/typescript6`, retaining the compiler API for compatibility tooling
and TS6 consumer checks. It provides `tsc6`, while the native package provides
`tsc`. Both are development
only. The build resolves the native executable explicitly because automatic
compiler discovery would find the TS6 compatibility package.

The declaration plugin still marks its TS7 generator experimental. The
`tsconfig.json` uses bundler module resolution instead of the removed Node 10
mode. `pnpm test:build:types` runs the existing tsd contracts plus a public API
consumer fixture compiled by both TS6 and TS7. The fixture resolves the built
package exports, so changing our compiler does not silently require consumers
to upgrade theirs. Renovate keeps the compatibility API on TS6 and the native
compiler on TS7.0 until the declaration plugin's supported range is reviewed.

`pnpm test:build` builds and validates the artifacts. CI uses
`pnpm test:build:artifacts` after building on Node 24 so that validation can run
on older supported runtimes without rebuilding. `pnpm test:package` packs
the existing build, installs it in a temporary consumer project with the same
24-hour dependency policy, and exercises the package's ESM and CommonJS exports.

### Vite+ updates

The root pnpm catalog pins `vite-plus` and the `vite` alias to the same Vite+
release. Renovate groups both catalog entries into one PR and never auto-merges
it. Vitest is an exact transitive dependency of Vite+: tests import
`vite-plus/test`, and TypeScript uses `vite-plus/test/globals`. Do not add an
independent Vitest version or override. The docs site keeps its separate pnpm
project and toolchain.

`pnpm check:toolchain` rejects mismatched Vite+/core versions or a Vitest version
that differs from Vite+'s declared version. The build runs this check, including
in CI. Review changes to bundled tsdown, Vitest, Oxlint and Oxfmt when upgrading
Vite+, then run the complete validation below.

Keep `minimumReleaseAge: 1440` without exceptions. Vite+'s migration command can
add `minimumReleaseAgeExclude` entries for its tools; remove those entries if
rerunning it and regenerate the lockfile with pnpm. Ordinary Renovate updates
also wait at least one day.

Oxlint runs the existing import resolution, dependency and ordering rules via
`eslint-plugin-import`, so its resolver dependencies remain installed. Oxlint's
JS-plugin compatibility layer is currently alpha; check these rules when updating
it. Prettier is no longer used by the library or SDK generator. The generator
uses `vite-plus/fmt` with the shared configuration.

### Publishing with pnpm 12

The release workflow runs Changesets with `pnpm exec`, builds with pnpm and packs
an explicit tarball with `pnpm pack`. It publishes that tarball using
`npm publish --provenance --access public`, preserving npm's GitHub OIDC trusted
publishing. pnpm 12 publishes natively, so upgrading npm would no longer control
the behavior of `pnpm publish`. Packing first also resolves the pnpm catalog
references in the published manifest. No registry credentials are added by this
migration.

### Validation

All dependency PRs use the existing `ci` workflow, with no path filters. It runs
frozen installs, lint, source typechecking, tests, builds, ESM/CJS imports,
exports, browser bundling, declaration tests, size limits and package packing
using Node 24 for the build tools. Each matrix job then switches to Node 22
or 24 to run unit tests, artifact checks and a fresh tarball installation.
It also checks dependency audits, generated code and the documentation build.
`pnpm test:dependency-policy` uses a local registry to verify both projects
reject fresh releases, missing publish dates and a lockfile containing fresh
versions, while selecting eligible direct and transitive releases.
The commands can be run locally with:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:build
pnpm test:package
pnpm test:dependency-policy
pnpm pack --out /tmp/comic-vine-sdk.tgz
pnpm audit
pnpm --dir docs-site install --frozen-lockfile
pnpm --dir docs-site audit
pnpm --dir docs-site build
```

Validate configuration edits with
`pnpm --package=renovate dlx renovate-config-validator --strict renovate.json`.
For dependency changes that need publishing, add a Changeset according to the
existing release process; merging a dependency PR alone does not publish npm
packages without a pending Changeset.

## Submitting Changes

### Pull Request Process

1. **Update Documentation**: Ensure README, JSDoc, and other docs reflect your changes

2. **Verify Quality Checks**: All checks must pass before merging

   ```bash
   pnpm test      # All tests pass
   pnpm lint      # No linting errors
   pnpm typecheck # Source types pass
   pnpm build     # Package builds successfully
   ```

3. **Create Pull Request**:
   - Use a descriptive title
   - Reference any related issues
   - Provide clear description of changes
   - Include examples if adding new features

4. **Review Process**:
   - Maintainers will review your PR
   - Address any feedback promptly
   - See [CODE_REVIEW.md](./CODE_REVIEW.md) for review criteria

### Pre-commit Hooks

The existing **Husky** hook runs `pnpm pre-commit`:

- **Auto-formatting**: Oxfmt formats project files
- **Validation**: Vite+ checks source formatting, lint rules and types
- **Tests**: Vitest runs the unit suite

If pre-commit hooks fail, fix the issues before committing:

```bash
pnpm lint:fix  # Apply available lint and format fixes
git add .  # Stage the fixes
git commit # Try committing again
```

## Project Structure

```
src/
├── comic-vine.ts              # Main SDK class
├── errors/                    # Custom error classes
├── http-client/               # HTTP client and URL builder
├── options/                   # Configuration options
├── resources/                 # API resource implementations
│   ├── base-resource.ts       # Base class for all resources
│   ├── character/             # Character-specific code
│   ├── issue/                 # Issue-specific code
│   └── ...                    # Other Comic Vine resources
├── types/                     # TypeScript type definitions
└── utils/                     # Utility functions
```

### Adding New Resources

When adding support for a new Comic Vine API resource:

1. Create a new directory under `src/resources/`
2. Implement the resource class extending `BaseResource`
3. Add TypeScript types in a `types/` subdirectory
4. Write comprehensive tests
5. Update the main `ComicVine` class to include the new resource
6. Add mock data for testing

## Resources

### Documentation

- [Comic Vine API Documentation](https://comicvine.gamespot.com/api/documentation)
- [Project README](./README.md)
- [Code Review Guidelines](./CODE_REVIEW.md)

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/AllyMurray/comic-vine/issues)
- **Discussions**: Use GitHub Discussions for questions

### Development Tools

- **Package Manager**: [pnpm](https://pnpm.io/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Toolchain**: [Vite+](https://viteplus.dev/)
- **Linting**: [Oxlint](https://oxc.rs/docs/guide/usage/linter.html)
- **Formatting**: [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)
- **Git Hooks**: [Husky](https://typicode.github.io/husky/)

---

Thank you for contributing to Comic Vine SDK! Your contributions help make this library better for everyone. 🚀
