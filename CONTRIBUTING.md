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

- **Node.js**: Version 20.0.0 or higher
- **pnpm**: Use the version pinned in `package.json` (currently 10.34.5).
  ```bash
  npm install -g pnpm@10.34.5
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
3. **Run Tests**: `pnpm test` to run tests and linting
4. **Build**: `pnpm compile` to ensure your changes compile correctly

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

The project uses **ESLint** and **Prettier** for code formatting:

```bash
# Auto-fix linting issues and format code
pnpm lint

# Check linting without fixing
npx eslint src --ext .ts
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
# Run all tests with linting
pnpm test

# Run tests only (without linting)
pnpm test:run

# Run tests in watch mode
npx vitest --dir=src
```

### Writing Tests

1. **Location**: Place test files alongside source files with `.test.ts` extension
2. **Naming**: Use descriptive test names that explain the behavior being tested
3. **Structure**: Follow Arrange-Act-Assert pattern

**Example Test:**

```typescript
import { describe, test, expect } from 'vitest';

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
The TypeScript library supports Node 20, 22 and 24 and is published publicly as
`comic-vine-sdk` through the existing Changesets release workflow. Its runtime
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
exemptions. Frozen installs continue to use the committed lockfiles; this policy
does not re-audit the publication age of versions already locked. The library
and docs site retain separate installs and lockfiles. Build-script allowlists
and dependency overrides also live in these pnpm configuration files.

Renovate waits one day before proposing ordinary npm updates, and keeps the
longer three-day delay for patch auto-merge candidates. These delays provide
time for compromised releases to be detected; they do not establish that a
package is safe.

Related lint/formatting, testing, TypeScript/build and `@types/*` updates are
grouped. Patch and minor PRs are separated only for stable development tools
eligible for patch auto-merge; manually reviewed groups combine non-major
updates to reduce duplicate PRs. GitHub Actions have their own group.
Non-major updates to `@http-client-toolkit/core` and
`@http-client-toolkit/store-memory` are grouped and always reviewed manually.
`size-limit` and `@size-limit/file` update together because the plugin requires
a matching `size-limit` version. This pair is the only exception to individual
major PRs: its coordinated major upgrades still require manual review and stay
separate from non-major updates. Unrelated major upgrades are never grouped.

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

Configure the `main` ruleset to require `validate (20.x)`, `validate (22.x)`,
`validate (24.x)` and `docs`, with branches up to date before merging. The
existing ruleset was inspected during setup and only prevented deletion and
force pushes; repository configuration files do not change those GitHub settings.
GitHub's "Allow auto-merge" setting is not needed for Renovate-managed merging.
Avoid granting Renovate a bypass of required checks. The legacy Mergify rule
references a `build` status and is not used by this Renovate policy.

### Validation

All dependency PRs use the existing `ci` workflow, with no path filters. It runs
frozen installs, lint, source typechecking, tests, builds, ESM/CJS imports,
exports, browser bundling, declaration tests, size limits and package packing
on each supported Node major. It also checks dependency audits, generated code
and the documentation build. The commands can be run locally with:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:build
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
   pnpm test:run  # All tests pass
   pnpm lint      # No linting errors
   pnpm compile   # Code compiles successfully
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

The project uses **Husky** and **lint-staged** to ensure code quality:

- **Auto-formatting**: Prettier formats code on commit
- **Linting**: ESLint checks are enforced
- **Type checking**: TypeScript compilation is verified

If pre-commit hooks fail, fix the issues before committing:

```bash
pnpm lint  # Fix linting issues
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
- **Linting**: [ESLint](https://eslint.org/) + [TypeScript ESLint](https://typescript-eslint.io/)
- **Formatting**: [Prettier](https://prettier.io/)
- **Git Hooks**: [Husky](https://typicode.github.io/husky/)

---

Thank you for contributing to Comic Vine SDK! Your contributions help make this library better for everyone. 🚀
