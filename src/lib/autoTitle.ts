// The title a new document takes from its own first line, as Apple Notes
// does, until the person renames it (owner, 2026-10-14: new documents only).
// Markdown marks are stripped; fenced code and rules are skipped. A document
// with no words yet keeps the title it has.

const FENCE = /^(`{3,}|~{3,})/
const SKIP = /^(-{3,}|\*{3,}|_{3,}|\$\$|\|?\s*:?-{3,})/
const MAX = 60

export function titleFromContent(content: string): string | null {
  let fence: string | null = null
  for (const raw of content.split('\n')) {
    const trimmed = raw.trim()
    const f = trimmed.match(FENCE)
    if (f) {
      fence = fence ? (trimmed.startsWith(fence) ? null : fence) : f[1].slice(0, 3)
      continue
    }
    if (fence || !trimmed || SKIP.test(trimmed)) continue
    const line = trimmed
      .replace(/^#{1,6}\s+/, '')
      .replace(/^(>\s*)+/, '')
      .replace(/^([-*+]|\d{1,9}[.)])\s+/, '')
      .replace(/^\[[ xX]\]\s+/, '')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/\*+|~~|`+/g, '')
      .replace(/(^|[^\p{L}\p{N}])_+|_+(?=[^\p{L}\p{N}]|$)/gu, '$1')
      .replace(/\|/g, ' ')
      // A "/" in a title is a folder in the workspace .zip — not wanted here.
      .replace(/\//g, '-')
      .replace(/\s+/g, ' ')
      .trim()
    if (!/[\p{L}\p{N}]/u.test(line)) continue
    if (line.length <= MAX) return line
    // Cut at a word boundary, never mid-word.
    return line.slice(0, MAX).replace(/\s+\S*$/, '') || line.slice(0, MAX)
  }
  return null
}
