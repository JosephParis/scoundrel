import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Build output, not source. dist-itch is the standalone (itch.io) target,
  // dist-steam the Electron one and dist-electron the packaged app; linting a
  // minified bundle produces hundreds of findings about code nobody wrote,
  // which is enough noise to hide a real one.
  globalIgnores(['dist', 'dist-itch', 'dist-steam', 'dist-electron']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Node-side code: Vercel serverless functions and Node test/tooling
    // scripts run with the Node globals (process, etc.), not the browser's.
    files: [
      'api/**/*.{js,jsx}', 'visual/**/*.{js,jsx}', 'test/**/*.{js,jsx}',
      'scripts/**/*.{js,mjs}', '*.config.{js,jsx}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // The Electron desktop shell. CommonJS, because package.json sets
    // `"type": "module"` for everything else and Electron's main process is
    // not ESM -- hence both the .cjs extension and this block, since the
    // browser-source block above matches only .js and .jsx.
    files: ['electron/**/*.cjs'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
      parserOptions: { ecmaVersion: 'latest' },
    },
  },
])
