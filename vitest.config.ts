import { defineConfig } from 'vitest/config';

// Unit tests run in a plain node environment (no DOM). Most cover pure logic in
// src/; electron/ tests cover main-process services that are electron/sqlite-free
// except app.getPath() (which they mock), so they run in node too.
export default defineConfig({
  test: {
    environment: 'node',
    // Repairs the Node 26 native-`localStorage` shadow under jsdom; a no-op
    // otherwise. See the file for why.
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'electron/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
});
