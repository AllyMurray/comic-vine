# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Package Management

- Always use `pnpm` instead of npm or yarn
- Install dependencies: `pnpm install`
- Build: `pnpm run build`
- Run tests: `pnpm run test`
- Run linting: `pnpm run lint`
- Fix linting issues: `pnpm run lint:fix`
- Format code: `pnpm run format`

### Development Workflow

- Pre-commit checks: `pnpm run pre-commit`
- Watch mode: `pnpm run dev`
- Clean build artifacts: `pnpm run clean`
- Build artifact tests: `pnpm run test:build`

## Architecture Overview

This is a single-package TypeScript library (`comic-vine-sdk`) for the Comic Vine API. HTTP, caching, deduplication, and rate limiting are delegated to `@http-client-toolkit/core`.

### Project Structure

- **`src/`** - All source code
  - **`src/resources/`** - Resource classes (character, issue, volume, etc.)
  - **`src/http-client/`** - URL builder, status codes, and toolkit adapter hooks
  - **`src/types/`** - TypeScript type definitions
  - **`src/errors/`** - Domain-specific error classes
  - **`src/utils/`** - Utilities (case conversion, etc.)
  - **`src/options/`** - Options validation with Zod
- **`build-tests/`** - Build artifact validation tests (ESM, CJS, exports)

### Key Architecture Patterns

#### Resource-Based API Structure

- Each Comic Vine resource (character, issue, volume, etc.) has its own class in `src/resources/`
- Resources inherit from `BaseResource` and implement `list()` and `retrieve()` methods
- Type definitions are organized by resource with separate types for list items and detail responses

#### Toolkit Integration via Hooks

- `@http-client-toolkit/core` provides the HTTP client with caching, deduplication, and rate limiting
- Three adapter hooks in `src/http-client/hooks.ts` connect the toolkit to Comic Vine:
  - `comicVineResponseTransformer` - converts snake_case API responses to camelCase
  - `comicVineResponseHandler` - maps Comic Vine status codes to domain errors
  - `comicVineErrorHandler` - maps HTTP errors (401, etc.) to domain errors
- Store interfaces (`CacheStore`, `DedupeStore`, `RateLimitStore`) come from `@http-client-toolkit/core`
- Store implementations come from separate packages (`@http-client-toolkit/store-memory`, etc.)

#### HTTP Client Architecture

- `HttpClient` from `@http-client-toolkit/core` handles all API communication
- `UrlBuilder` constructs Comic Vine API URLs with proper parameter formatting
- Domain error classes extend `HttpClientError` from the toolkit

### TypeScript Conventions

- Never use `any` type - always use proper TypeScript types
- Use `unknown` only when genuinely unknown (e.g., JSON parsing) and always narrow with type guards
- Avoid type assertions (`as`) - use type guards instead
- All resources have detailed type definitions for both list and detail responses

### Testing Strategy

- Uses Vitest for all testing
- Comprehensive test coverage with mocked API responses in `src/__mocks__/`
- nock for HTTP request interception (works with toolkit's fetch-based client)
- Each resource and utility has corresponding `.test.ts` files
- Tests focus on type safety, error handling, and API contract compliance

### Build System

- Dual ESM/CJS builds via tsup
- Automatic type generation with TypeScript
- Output in `lib/` directory
