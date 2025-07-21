import { defineConfig } from 'vitest/config';
import { sharedVitestConfig } from '@repo/vitest-config';

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedVitestConfig.test,
    // Add package-specific overrides here if needed
  },
});
