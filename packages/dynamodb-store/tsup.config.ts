import { sharedTsupConfig } from '@repo/tsup-config';
import { defineConfig } from 'tsup';

export default defineConfig({
  ...sharedTsupConfig,
  format: [...sharedTsupConfig.format],
});
