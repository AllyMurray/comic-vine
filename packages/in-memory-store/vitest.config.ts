import { sharedVitestConfig } from '@comic-vine/vitest-config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedVitestConfig.test,
    // Add package-specific overrides here if needed
  },
});
