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
      // The version changes whenever any file does (hashed names) or the
      // list does.
      const hash = createHash('sha256')
      for (const f of files) hash.update(f)
      for (const chunk of Object.values(bundle)) if (chunk.type === 'asset' && chunk.fileName === 'index.html') hash.update(String(chunk.source))
      const template = readFileSync(path.resolve(import.meta.dirname, 'scripts/sw.template.js'), 'utf8')
      const source = template.replace('__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 12))).replace('__FILES__', JSON.stringify(files.map((f) => `/${f}`)))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

const pkg = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), offline()],
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
