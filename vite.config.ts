import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  preview: { headers: siteHeaders() },
})
