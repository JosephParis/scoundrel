import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// Build stamp. Resolved once when the config loads (i.e. at build time), then
// frozen into the client bundle via `define` below so the site can show which
// build it's running. Self-updating: nothing to hand-edit per deploy.
//
// On Vercel the git SHA/branch come from the build env (no repo access needed
// in the container); locally we fall back to `git`. All of this is public for
// a public repo, so it's safe to ship to the browser.
function gitShort() {
  try {
    return execSync('git rev-parse --short=7 HEAD').toString().trim()
  } catch {
    return ''
  }
}

const fullSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || ''
const buildSha = (fullSha ? fullSha.slice(0, 7) : gitShort()) || 'dev'
const buildRef = process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || ''
const buildTime = new Date().toISOString()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Override entries on import.meta.env so client code reads them with no
    // extra globals and ESLint stays happy. Values are inlined at build time.
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify(buildSha),
    'import.meta.env.VITE_BUILD_REF': JSON.stringify(buildRef),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]node_modules[\\/]posthog-js[\\/]/.test(id)) return 'posthog'
        },
      },
    },
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(d => !/(^|\/)posthog[-.]/.test(d)),
    },
  },
})
