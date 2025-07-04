# Comic Vine Monorepo

[![License](https://img.shields.io/npm/l/@comic-vine/client)](https://github.com/AllyMurray/comic-vine/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/@comic-vine/client)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

A monorepo containing packages for interacting with the [Comic Vine API][comic-vine-api]. The Comic Vine API provides full access to the structured-wiki content for comics, characters, publishers, and more.

## Table of Contents

- [Packages](#packages)
- [Getting Started](#getting-started)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Authors](#authors)

## Packages

This monorepo contains the following packages:

### [`@comic-vine/client`](./packages/client)

[![NPM Version](https://img.shields.io/npm/v/@comic-vine/client)](https://www.npmjs.com/package/@comic-vine/client)

A TypeScript/JavaScript client library for the Comic Vine API. Provides convenient access to all Comic Vine resources with full type safety, error handling, and advanced features like auto-pagination.

**Features:**

- Full TypeScript support with auto-generated types
- Comprehensive error handling
- Auto-pagination for large datasets
- Field limiting for optimal performance
- Rate limiting best practices
- Support for all Comic Vine resources

**Installation:**

```bash
npm install @comic-vine/client
```

**Quick Start:**

```js
import ComicVine from '@comic-vine/client';

const comicVine = new ComicVine('your-api-key-here');
const publisher = await comicVine.publisher.retrieve(1859);
console.log(publisher.name);
```

[📖 Full Documentation](./packages/client/README.md)

## Getting Started

### Prerequisites

- Node.js 20.0.0 or higher
- npm, yarn, or pnpm

### API Key

To use any of the packages, you'll need a Comic Vine API key. [Get your API key here][comic-vine-api].

⚠️ **Important**: Never expose your API key in client-side code or commit it to version control.

### Quick Installation

Choose the package you need and install it:

```bash
# For the main client library
npm install @comic-vine/client

# Or with pnpm
pnpm add @comic-vine/client

# Or with yarn
yarn add @comic-vine/client
```

## Development

This monorepo uses [pnpm workspaces](https://pnpm.io/workspaces) and [Turbo](https://turbo.build/) for efficient package management and build orchestration.

### Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/AllyMurray/comic-vine.git
cd comic-vine
pnpm install
```

### Available Scripts

**Build all packages:**

```bash
pnpm build
```

**Run tests for all packages:**

```bash
pnpm test
```

**Lint all packages:**

```bash
pnpm lint
```

**Format all files:**

```bash
pnpm format
```

**Start development mode:**

```bash
pnpm dev
```

**Clean all build artifacts:**

```bash
pnpm clean
```

### Working with Individual Packages

Navigate to a package directory to work with it individually:

```bash
cd packages/client
pnpm test
pnpm build
```

### Project Structure

```
comic-vine/
├── packages/
│   └── client/          # Comic Vine API client library
├── package.json         # Root package.json with workspace configuration
├── pnpm-workspace.yaml  # pnpm workspace configuration
├── turbo.json          # Turbo build configuration
└── README.md           # This file
```

## Roadmap

- **Enhanced Client Features**
  - Built-in caching mechanisms
  - Advanced rate limiting
  - Request deduplication
  - Response compression

- **Additional Packages**
  - CLI tools for Comic Vine API
  - React hooks for Comic Vine data
  - Validation utilities
  - Mock data generators for testing

- **Developer Experience**
  - Interactive API explorer
  - Code generation tools
  - Enhanced TypeScript definitions
  - Performance monitoring

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) before submitting pull requests.

### Getting Started with Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Run the full test suite
6. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Maintain test coverage above 90%
- Update documentation for new features
- Follow conventional commit messages
- Ensure all CI checks pass

## Authors

- [@AllyMurray](https://github.com/AllyMurray)

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

[comic-vine-api]: https://comicvine.gamespot.com/api
