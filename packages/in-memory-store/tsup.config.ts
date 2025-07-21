import { defineConfig } from 'tsup';
import { sharedTsupConfig } from '@repo/tsup-config';

export default defineConfig({
  ...sharedTsupConfig,
  // Add package-specific overrides here if needed
});
