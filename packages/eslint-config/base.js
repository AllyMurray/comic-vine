import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintPluginImport from 'eslint-plugin-import';

/**
 * Base ESLint configuration for all packages
 * @type {import('eslint').Linter.Config[]}
 */
export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      prettier: eslintPluginPrettier,
      import: eslintPluginImport,
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        node: {},
        typescript: {
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
            '**/vitest.config.ts',
            '**/tsup.config.ts',
            '**/*.test.ts',
            '**/*.test.tsx',
          ],
          optionalDependencies: false,
          peerDependencies: true,
          includeInternal: true,
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
        },
      ],
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'generic',
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
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': ['error'],
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'generic',
        },
      ],
    },
  },
];
