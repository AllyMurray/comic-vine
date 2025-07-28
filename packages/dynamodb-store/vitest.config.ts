import { defineConfig } from 'vitest/config';
import { sharedVitestConfig } from '@repo/vitest-config';

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedVitestConfig.test,
    name: '@comic-vine/dynamodb-store',
  },
});
