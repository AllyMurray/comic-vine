# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Package Management

- Always use `pnpm` instead of npm or yarn
- Install dependencies: `pnpm install`
- Build all packages: `pnpm run build`
- Run tests: `pnpm run test`
- Run linting: `pnpm run lint`
- Fix linting issues: `pnpm run lint:fix`
- Format code: `pnpm run format`

### Development Workflow

- Pre-commit checks: `pnpm run pre-commit`
- Parallel development: `pnpm run dev`
- Clean build artifacts: `pnpm run clean`
- Release workflow: `pnpm run changeset` → `pnpm run version-packages` → `pnpm run release`

## Architecture Overview

This is a TypeScript monorepo for the Comic Vine API client library with the following structure:

### Core Packages

- **`packages/client`** - Main Comic Vine API client with resource classes, HTTP client, and type definitions
- **`packages/in-memory-store`** - In-memory implementations of cache, deduplication, and rate limiting stores
- **`packages/sqlite-store`** - SQLite-based persistent store implementations
- **`packages/eslint-config`** - Shared ESLint configurations
- **`packages/tsup-config`** - Shared build configurations
- **`packages/vitest-config`** - Shared test configurations

### Key Architecture Patterns

#### Resource-Based API Structure

- Each Comic Vine resource (character, issue, volume, etc.) has its own class in `packages/client/src/resources/`
- Resources inherit from `BaseResource` and implement `list()` and `retrieve()` methods
- Type definitions are organized by resource with separate types for list items and detail responses

#### Store Pattern for Cross-Cutting Concerns

- **Cache Store**: Implements caching with TTL support
- **Dedupe Store**: Prevents duplicate concurrent requests
- **Rate Limit Store**: Handles API rate limiting per resource type
- Stores can be swapped between in-memory and SQLite implementations

#### HTTP Client Architecture

- `HttpClient` handles all API communication with built-in retry logic
- `UrlBuilder` constructs Comic Vine API URLs with proper parameter formatting
- `HttpClientFactory` creates clients with appropriate store configurations

### TypeScript Conventions

- Never use `any` type - always use proper TypeScript types
- Use `unknown` only when genuinely unknown (e.g., JSON parsing) and always narrow with type guards
- Avoid type assertions (`as`) - use type guards instead
- All resources have detailed type definitions for both list and detail responses

### Testing Strategy

- Uses Vitest for all testing
- Comprehensive test coverage with mocked API responses in `__mocks__/`
- Each resource and utility has corresponding `.test.ts` files
- Tests focus on type safety, error handling, and API contract compliance

### Build System

- Uses Turbo for monorepo management
- Dual ESM/CJS builds via tsup
- Automatic type generation with TypeScript
- Changesets for version management and publishing
