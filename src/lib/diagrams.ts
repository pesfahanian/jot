// Mermaid diagrams (Phase 9, frame 2h): a ```mermaid fence renders as the
// diagram, in a bordered frame whose footer names the diagram type. Mermaid
// loads only when a document has such a fence; diagrams are drawn before
// the markdown renders (Mermaid is async, the renderer isn't) and cached.
//
// "strict" security: Mermaid sanitises labels and allows no click handlers
// or scripts. Colours are Jot's tokens as plain hex — Mermaid's colour
// library can't read the oklch() values the CSS uses.

type Mermaid = typeof import('mermaid').default
export type DiagramTheme = 'light' | 'dark'

const PALETTE: Record<DiagramTheme, Record<string, string | boolean>> = {
  light: {
    darkMode: false,
    background: '#FBFCFD',
    primaryColor: '#E4E6E9',
    primaryTextColor: '#25292F',
    primaryBorderColor: '#B4B8BC',
    secondaryColor: '#EEF0F3',
    tertiaryColor: '#F1F4F6',
    lineColor: '#868B91',
    textColor: '#25292F',
    noteBkgColor: '#F2ECB6',
    noteTextColor: '#25292F',
    noteBorderColor: '#CCD0D3',
  },
  dark: {
    darkMode: true,
    background: '#141416',
    primaryColor: '#1F1F22',
    primaryTextColor: '#F2F1EC',
    primaryBorderColor: '#3A3A3F',
    secondaryColor: '#18181B',
    tertiaryColor: '#111113',
    lineColor: '#7E7A71',
    textColor: '#F2F1EC',
    noteBkgColor: '#433E19',
    noteTextColor: '#F2F1EC',
    noteBorderColor: '#2A2A2E',
  },
}

let mermaid: Promise<Mermaid> | undefined
let current: DiagramTheme | null = null
let seq = 0
const cache = new Map<string, string>()

const FENCE = /^[ \t>]*(`{3,}|~{3,})[ \t]*mermaid\b[^\n]*\n([\s\S]*?)\n[ \t>]*\1[ \t]*$/gm
const key = (theme: DiagramTheme, source: string) => `${theme}\n${source.trim()}`
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The diagram's type for the frame's footer: its first word ("flowchart",
// "sequenceDiagram", …), skipping comments and front matter.
export function diagramType(source: string): string {
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, '')
  const first = body.split('\n').find((l) => l.trim() && !l.trim().startsWith('%%'))
  return first?.trim().split(/\s+/)[0] ?? 'diagram'
}

// Draws every mermaid fence in `md` (for the given theme) into the cache.
export async function loadDiagrams(md: string, theme: DiagramTheme): Promise<void> {
  const sources = [...md.matchAll(FENCE)].map((m) => m[2]).filter((s) => !cache.has(key(theme, s)))
  if (!sources.length) return
  mermaid ??= import('mermaid').then((m) => m.default)
  const m = await mermaid
  if (current !== theme) {
    m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', fontFamily: '"Public Sans", Helvetica, sans-serif', themeVariables: PALETTE[theme] })
    current = theme
  }
  for (const source of sources) {
    try {
      const { svg } = await m.render(`jot-mermaid-${++seq}`, source.trim())
      cache.set(key(theme, source), svg)
    } catch (e) {
      cache.set(key(theme, source), `<div class="jot-diagram-error">couldn't draw this diagram: ${escape(String((e as Error).message ?? e).split('\n')[0])}</div><pre><code>${escape(source.trim())}</code></pre>`)
    }
  }
}

// The framed diagram for a mermaid fence, or null if it isn't drawn yet.
export function diagramHtml(source: string, theme: DiagramTheme): string | null {
  const drawn = cache.get(key(theme, source))
  if (drawn === undefined) return null
  return `<figure class="jot-diagram"><div class="jot-diagram-body">${drawn}</div><figcaption>mermaid · ${escape(diagramType(source))}</figcaption></figure>\n`
}
