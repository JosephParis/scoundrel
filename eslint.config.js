import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Build output, not source. dist-itch is the standalone (itch.io) target;
  // linting a minified bundle produces hundreds of findings about code nobody
  // wrote, which is enough noise to hide a real one.
  globalIgnores(['dist', 'dist-itch']),
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
])
