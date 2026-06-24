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
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
