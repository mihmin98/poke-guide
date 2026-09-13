// Unit tests for the Node data pipeline (scripts/). The Angular app's tests run through `ng test`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.spec.ts'],
    environment: 'node',
    globals: true,
  },
});
