# Contributing to Comic Vine SDK

Thank you for your interest in contributing to the Comic Vine SDK! This document provides guidelines and information to help you contribute effectively to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Project Structure](#project-structure)
- [Resources](#resources)

## Code of Conduct

This project adheres to a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [allymurray88@gmail.com](mailto:allymurray88@gmail.com).

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20.0.0 or higher
- **pnpm**: Version 9.15.4+ (specified in package.json)
  ```bash
  npm install -g pnpm@9.15.4
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
