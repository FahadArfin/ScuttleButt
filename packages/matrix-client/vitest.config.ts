import { defineConfig } from 'vitest/config';

export default defineConfig({
  ssr: {
    noExternal: ['matrix-js-sdk'],
  },
  test: {
    exclude: ['src/**/*.integration.test.ts'],
    include: ['src/**/*.test.ts'],
  },
});
