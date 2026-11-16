import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The headers Cloudflare Pages serves for every page (public/_headers), so
// `pnpm preview` runs under the same Content-Security-Policy as production.
function siteHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  let inSite = false
  for (const line of readFileSync(path.resolve(import.meta.dirname, 'public/_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      inSite = line.trim() === '/*'
      continue
    }
    const at = line.indexOf(':')
    if (inSite && at > 0) headers[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return headers
}

// The service worker (scripts/sw.template.js), written into the build with
// the list of files it keeps: everything the app is made of, so it opens
// and works offline. Older font formats (.woff, .ttf) are left out —
// browsers that run service workers all take .woff2. Not in dev.
function offline(): Plugin {
  const skip = (f: string) => /\.(map|woff|ttf)$/.test(f) || f === '_headers' || f.endsWith('LICENSE.txt') || f === 'sw.js'
  const walk = (dir: string, base = ''): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`]))
  return {
    name: 'jot-offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = [...new Set([...Object.keys(bundle), ...walk(path.resolve(import.meta.dirname, 'public'))])].filter((f) => !skip(f)).sort()
      // The version changes whenever any file does (hashed names), the list
      // does, the response headers do — the kept page is served with the
      // headers it was kept with, so a new security policy needs a new
      // version to reach anyone.
      const hash = createHash('sha256')
      for (const f of files) hash.update(f)
      hash.update(readFileSync(path.resolve(import.meta.dirname, 'public/_headers')))
      for (const chunk of Object.values(bundle)) if (chunk.type === 'asset' && chunk.fileName === 'index.html') hash.update(String(chunk.source))
      // …or the service worker's own code does.
      const template = readFileSync(path.resolve(import.meta.dirname, 'scripts/sw.template.js'), 'utf8')
      hash.update(template)
      // The page is kept as "/", its real address: the host redirects
      // /index.html there, and Chromium browsers refuse a redirected answer
      // when opening a page (ERR_FAILED).
      const source = template.replace('__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 12))).replace('__FILES__', JSON.stringify(files.map((f) => (f === 'index.html' ? '/' : `/${f}`))))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// Cloudflare Web Analytics (owner, 2026-11-16): how many visits, from
// where — no cookies, nothing from documents. Installed by hand rather than
// injected by Cloudflare, because the service worker serves its kept copy of
// the page: an injected script would only reach browsers whose copy happened
// to be kept after it was turned on. Production builds only. The token is
// public by design (it's in every visitor's page). The security policy
// allows the script and its reports (public/_headers).
const WEB_ANALYTICS_TOKEN = '1eb058d2ad8c486b82a5983924c82828'
function webAnalytics(): Plugin {
  return {
    name: 'jot-web-analytics',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'script',
        attrs: { type: 'module', src: 'https://static.cloudflareinsights.com/beacon.min.js', 'data-cf-beacon': JSON.stringify({ token: WEB_ANALYTICS_TOKEN }) },
        injectTo: 'body',
      },
    ],
  }
}

const pkg = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), webAnalytics(), offline()],
  // Settings → about: the version and the day it was built.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  preview: { headers: siteHeaders() },
})
