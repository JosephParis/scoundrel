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

// Absolute origin for the social-card tags (issue 04). og:image and og:url are
// supposed to be absolute, and the domain is not knowable from the source tree,
// so it is resolved at build time instead of hardcoded:
//
//   VITE_SITE_URL                    explicit override, wins if set
//   VERCEL_PROJECT_PRODUCTION_URL    the project's canonical production domain
//
// Falls back to '', which leaves the paths relative. Most scrapers resolve those
// against the page URL anyway, so a local build still previews sanely; production
// on Vercel gets the absolute form for free.
function siteUrl() {
  const explicit = process.env.VITE_SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`
  return ''
}

// Substitutes __SITE_URL__ in index.html. A plugin rather than `define`, because
// `define` only reaches JS, not the HTML entry.
function htmlSiteUrl() {
  const origin = siteUrl()
  return {
    name: 'scoundrel-html-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', origin)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), htmlSiteUrl()],
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
