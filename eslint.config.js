// @ts-check
import { baseConfig } from '@repo/eslint-config/base';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: ['packages/*/dist/**', 'packages/*/node_modules/**'],
  },
];
