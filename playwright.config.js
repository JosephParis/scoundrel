import { defineConfig } from '@playwright/test'

// Visual screenshot harness. Captures the font-heavy screens so a font/theme
// change can be eyeballed before vs after. Run twice into different folders
// via SHOT_DIR (see visual/screens.spec.js): once on the current tree, once
// with the change reverted, then diff the two folders by eye.
export default defineConfig({
  testDir: './visual',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  },

  // Two harnesses, split by filename. Most behavior is identical in either
  // build, so it belongs in the fast dev-server project. A few things only
  // exist in a production bundle -- the dev-tools gate is deliberately open
  // whenever import.meta.env.DEV is true -- and asserting those against the dev
  // server would test the opposite of what ships. Those specs are named
  // *.prod.spec.js and run against a real build served by vite preview.
  projects: [
    {
      name: 'dev',
      testIgnore: /\.prod\.spec\.js$/,
      use: { baseURL: 'http://localhost:5173' },
    },
    {
      name: 'prod',
      testMatch: /\.prod\.spec\.js$/,
      use: { baseURL: 'http://localhost:4173' },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      // Rebuilds every run so dist/ can never go stale against the tree under
      // test -- a preview server serving a previous build would report on code
      // that isn't there any more. reuseExistingServer is false for the same
      // reason: a leftover preview from an earlier build must fail loudly
      // rather than be silently trusted.
      command: 'npm run build && npm run preview -- --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
})
