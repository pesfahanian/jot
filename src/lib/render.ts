import type { Marked, Token, TokensList } from 'marked'

// The one markdown → HTML renderer, shared by the rendered pane and PDF
// export so the two never drift apart. GFM, as VSCode's preview renders it:
// tables, task lists, strikethrough, autolinks. marked loads on first use.
//
// Safety: raw HTML in a document is shown as text, never parsed — pasted
// web content can't run inside Jot, which holds the person's API keys.
// Links to anything but http(s), mailto and in-page anchors are dropped, and
// real links open in a new tab.

let instance: Promise<Marked> | undefined

const SAFE_HREF = /^(https?:|mailto:|#)/i
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function load(): Promise<Marked> {
  instance ??= import('marked').then(({ Marked }) => {
    const m = new Marked({ gfm: true })
    m.use({
      renderer: {
        html({ text }) {
          return escape(text)
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

export async function renderHtml(md: string): Promise<string> {
  return (await load()).parse(md, { async: false })
}

// A rendered top-level block and the source line it starts on (0-based) —
// the anchors scroll sync maps between.
export interface RenderedBlock {
  line: number
  html: string
}

export async function renderBlocks(md: string): Promise<RenderedBlock[]> {
  const m = await load()
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
