// @ts-check
import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,

  // Prettier config to disable formatting rules that conflict with Prettier
  prettierConfig,

  // Base configuration for all files
  {
    plugins: {
      import: importPlugin,
      prettier: prettierPlugin,
    },

    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },

    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        node: {},
        typescript: {
          project: './tsconfig.dev.json',
          alwaysTryTypes: true,
        },
      },
    },

    rules: {
      'prettier/prettier': ['error'],
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/test/**',
            '**/build-tools/**',
            '.projenrc.ts',
            'projenrc/**/*.ts',
          ],
          optionalDependencies: false,
          peerDependencies: true,
        },
      ],
      'import/no-unresolved': ['error'],
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'no-duplicate-imports': ['error'],
      'no-shadow': ['off'],
      '@typescript-eslint/no-shadow': ['error'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'key-spacing': ['error'],
      'no-multiple-empty-lines': ['error'],
      '@typescript-eslint/no-floating-promises': ['error'],
      'no-return-await': ['off'],
      '@typescript-eslint/return-await': ['error'],
      'no-trailing-spaces': ['error'],
      'dot-notation': ['error'],
      'no-bitwise': ['error'],
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'public-static-field',
            'public-static-method',
            'protected-static-field',
            'protected-static-method',
            'private-static-field',
            'private-static-method',
            'field',
            'constructor',
            'method',
          ],
        },
      ],
    },
  },

  // Configuration for TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        project: './tsconfig.dev.json',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': ['error'],
    },
  },

  // Configuration for test files
  {
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
    rules: {
      'dot-notation': 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true,
        },
      ],
    },
  },

  // Configuration for .projenrc.ts
  {
    files: ['.projenrc.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },

  // Global ignores
  {
    ignores: [
      '*.js',
      '*.d.ts',
      'node_modules/',
      '*.generated.ts',
      'coverage',
      'scripts/create-package-json.ts',
      '!.projenrc.ts',
      '!projenrc/**/*.ts',
    ],
  },
);
