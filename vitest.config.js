import { defineConfig } from 'vitest/config'

// Unit tests for pure logic. Deliberately scoped away from `visual/`, which is
// Playwright's testDir -- vitest would otherwise try to collect those specs and
// fail on the Playwright fixtures they import.
export default defineConfig({
  test: {
    include: ['test/**/*.test.js', 'src/**/*.test.js', 'api/**/*.test.js'],
    environment: 'node',
  },
})
