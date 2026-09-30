import { highlightCode, tagHighlighter } from '@lezer/highlight'
import type { Marked, Token, TokensList } from 'marked'
import { CODE_GROUPS, findCodeLanguage } from './code'
import { diagramHtml, loadDiagrams, type DiagramTheme } from './diagrams'
import { loadMath, mathExtension } from './math'

// The one markdown → HTML renderer, shared by the rendered pane and PDF
// export so the two never drift apart. GFM, as VSCode's preview renders it:
// tables, task lists, strikethrough, autolinks. marked loads on first use.
//
// Safety: raw HTML in a document is shown as text, never parsed — pasted
// web content can't run inside Jot, which holds the person's API keys.
// Links to anything but http(s), mailto and in-page anchors are dropped, and
// real links open in a new tab.
//
// Fenced code is coloured by its own language with the same grammars and
// colour groups as the editor (lib/code.ts), as code-* classes. A mermaid
// fence renders as its diagram (lib/diagrams.ts) and $…$ / $$…$$ as math
// (lib/math.ts) — each library loading only when a document uses it.

const codeHighlighter = tagHighlighter(CODE_GROUPS.flatMap((g) => g.tags.map((tag) => ({ tag, class: `code-${g.name}` }))))

// Grammars load asynchronously; everything a document's fences name is
// loaded before rendering, so the render itself stays synchronous.
async function loadCodeLanguages(md: string) {
  const names = new Set([...md.matchAll(/^[ \t>]*(?:`{3,}|~{3,})[ \t]*([^\s`]+)/gm)].map((m) => m[1]))
  await Promise.all([...names].map((n) => findCodeLanguage(n)?.load().catch(() => undefined)))
}

let instance: Promise<Marked> | undefined
// The theme diagrams are drawn in for the render in progress (set just
// before each synchronous parse).
let theme: DiagramTheme = 'light'

export interface RenderOptions {
  // Diagram colours: the rendered view follows the app theme; print is light.
  theme?: DiagramTheme
}

// Everything a document needs that loads asynchronously, loaded before the
// synchronous parse: code grammars, KaTeX, drawn diagrams.
async function prepare(md: string, opts: RenderOptions): Promise<Marked> {
  const [m] = await Promise.all([load(), loadCodeLanguages(md), loadMath(md), loadDiagrams(md, opts.theme ?? 'light')])
  return m
}

const SAFE_HREF = /^(https?:|mailto:|#)/i
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function load(): Promise<Marked> {
  instance ??= import('marked').then(({ Marked }) => {
    const m = new Marked({ gfm: true })
    m.use(mathExtension)
    m.use({
      renderer: {
        html({ text }) {
          return escape(text)
        },
        code({ text, lang }) {
          const name = lang?.trim().split(/\s+/)[0]
          if (name === 'mermaid') {
            const diagram = diagramHtml(text, theme)
            if (diagram) return diagram
          }
          const cls = name ? ` class="language-${escape(name)}"` : ''
          const support = findCodeLanguage(name)?.support
          if (!support) return `<pre><code${cls}>${escape(text)}</code></pre>\n`
          let html = ''
          highlightCode(
            text,
            support.language.parser.parse(text),
            codeHighlighter,
            (piece, classes) => (html += classes ? `<span class="${classes}">${escape(piece)}</span>` : escape(piece)),
            () => (html += '\n'),
          )
          return `<pre><code${cls}>${html}</code></pre>\n`
        },
        link({ href, title, tokens }) {
          const text = this.parser.parseInline(tokens)
          if (!SAFE_HREF.test(href.trim())) return text
          const t = title ? ` title="${escape(title)}"` : ''
          const external = href.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"'
          return `<a href="${escape(href)}"${t}${external}>${text}</a>`
        },
      },
    })
    return m
  })
  return instance
}

export async function renderHtml(md: string, opts: RenderOptions = {}): Promise<string> {
  const m = await prepare(md, opts)
  // Set in the same synchronous stretch as the parse, so a concurrent render
  // in the other theme can't interleave.
  theme = opts.theme ?? 'light'
  return m.parse(md, { async: false })
}

// A rendered top-level block and the source line it starts on (0-based) —
// the anchors scroll sync maps between.
export interface RenderedBlock {
  line: number
  html: string
}

export async function renderBlocks(md: string, opts: RenderOptions = {}): Promise<RenderedBlock[]> {
  const m = await prepare(md, opts)
  theme = opts.theme ?? 'light'
  const tokens = m.lexer(md)
  const out: RenderedBlock[] = []
  let line = 0
  for (const token of tokens as Token[]) {
    if (token.type !== 'space') {
      // One block at a time, sharing the document's link definitions.
      const one = Object.assign([token], { links: (tokens as TokensList).links }) as TokensList
      out.push({ line, html: m.parser(one) })
    }
    line += (token.raw.match(/\n/g) ?? []).length
  }
  return out
}
