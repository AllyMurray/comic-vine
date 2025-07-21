import globals from 'globals';
import { baseConfig } from './base.js';

/**
 * ESLint configuration for library packages
 * @type {import('eslint').Linter.Config[]}
 */
export const libraryConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Library-specific rules can be added here
    },
  },
];
