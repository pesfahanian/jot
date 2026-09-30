import { markdownLanguage } from '@codemirror/lang-markdown'
import type { SyntaxNode } from '@lezer/common'
import { renderHtml } from './render'

// Export (T3.6, 6a): three formats, triggered straight from the menu — no
// intermediate dialog of Jot's own.

export function exportFilename(title: string, ext: string): string {
  const base = title.replace(/[/\\:*?"<>|]+/g, '-').trim() || 'untitled'
  return `${base}.${ext}`
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportMarkdown(title: string, content: string) {
  download(exportFilename(title, 'md'), content, 'text/markdown;charset=utf-8')
}

export function exportPlainText(title: string, content: string) {
  download(exportFilename(title, 'txt'), toPlainText(content), 'text/plain;charset=utf-8')
}

// Plain text is markdown stripped to clean prose (PRD §7) — not the raw
// source under a .txt name. Walks the same GFM parse tree the editor uses:
// markup characters are dropped, text is kept, block structure becomes line
// breaks. Link and image targets go; their visible text stays. List items
// keep a plain bullet or number, tasks a box, since those carry meaning.
export function toPlainText(md: string): string {
  const tree = markdownLanguage.parser.parse(md)
  const out: string[] = []
  const text = (from: number, to: number) => md.slice(from, to)

  // Inline content of a node, minus its markup children.
  function inline(node: SyntaxNode): string {
    let s = ''
    let at = node.from
    for (let c = node.firstChild; c; c = c.nextSibling) {
      s += text(at, c.from)
      at = c.to
      switch (c.name) {
        case 'EmphasisMark':
        case 'CodeMark':
        case 'StrikethroughMark':
        case 'HeaderMark':
        case 'QuoteMark':
        case 'ListMark':
        case 'TaskMarker':
        case 'LinkMark':
        case 'URL':
        case 'LinkTitle':
        case 'LinkLabel':
        case 'HTMLTag':
        case 'Comment':
          break
        case 'Escape':
          s += text(c.from + 1, c.to)
          break
        case 'HardBreak':
          s += '\n'
          break
        default:
          s += inline(c)
      }
    }
    return s + text(at, node.to)
  }

  function block(node: SyntaxNode, prefix = '') {
    const name = node.name
    if (/^(ATX|Setext)Heading/.test(name) || name === 'Paragraph') {
      out.push(prefix + inline(node).replace(/\s*\n\s*/g, ' ').trim())
      out.push('')
      return
    }
    if (name === 'FencedCode' || name === 'CodeBlock') {
      const code = node.getChildren('CodeText').map((c) => text(c.from, c.to)).join('')
      const lines = name === 'CodeBlock' ? code.split('\n').map((l) => l.replace(/^ {1,4}/, '')) : code.split('\n')
      out.push(...lines.map((l) => prefix + l))
      out.push('')
      return
    }
    if (name === 'HorizontalRule' || name === 'HTMLBlock' || name === 'CommentBlock' || name === 'LinkReference') {
      return
    }
    if (name === 'Blockquote') {
      for (let c = node.firstChild; c; c = c.nextSibling) if (c.name !== 'QuoteMark') block(c, prefix)
      return
    }
    if (name === 'BulletList' || name === 'OrderedList') {
      let n = 1
      for (let item = node.firstChild; item; item = item.nextSibling) {
        if (item.name !== 'ListItem') continue
        const mark = item.getChild('ListMark')
        const bullet = name === 'OrderedList' ? `${mark ? parseInt(text(mark.from, mark.to), 10) || n : n}. ` : '• '
        n++
        let first = true
        for (let c = item.firstChild; c; c = c.nextSibling) {
          if (c.name === 'ListMark') continue
          if (c.name === 'Task') {
            const marker = c.getChild('TaskMarker')
            const done = marker && /x/i.test(text(marker.from, marker.to))
            out.push(prefix + (done ? '☑ ' : '☐ ') + inline(c).trim())
          } else if (first && (c.name === 'Paragraph' || /Heading/.test(c.name))) {
            out.push(prefix + bullet + inline(c).replace(/\s*\n\s*/g, ' ').trim())
          } else {
            const before = out.length
            block(c, prefix + '  ')
            // Nested blocks inside an item don't need their own blank line.
            if (out.length > before && out[out.length - 1] === '') out.pop()
          }
          first = false
        }
      }
      out.push('')
      return
    }
    if (name === 'Table') {
      for (let row = node.firstChild; row; row = row.nextSibling) {
        if (row.name !== 'TableHeader' && row.name !== 'TableRow') continue
        out.push(prefix + row.getChildren('TableCell').map((c) => inline(c).trim()).join('\t'))
      }
      out.push('')
      return
    }
    for (let c = node.firstChild; c; c = c.nextSibling) block(c, prefix)
  }

  block(tree.topNode)
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// PDF goes through the renderer (6a's note, lib/render.ts — the same one
// the rendered view uses): markdown → HTML, set in the rendered-pane
// typography (§1.8), laid out into real pages by Paged.js (Phase 9), then
// the browser's own print-to-PDF.
//
// Pages (owner): A4, the 520px reading measure as the page's text width,
// page numbers in the footer. No code block, diagram, formula, quote or
// table row is split across a page break; a table taller than a page
// continues between rows with its header row repeated; a heading always
// travels with what follows it. Tuned against docs/benchmarks/pdf-benchmark.md.

const printCss = `
  @page {
    size: A4;
    margin: 22mm 36mm 24mm;
    @bottom-center { content: counter(page) " / " counter(pages); font-family: "Source Code Pro", ui-monospace, monospace; font-size: 8.5pt; color: #868B91; }
  }
  html, body { background: #fff; }
  body { font-family: "Public Sans", Helvetica, sans-serif; font-size: 14.5px; line-height: 1.58; color: #25292F; margin: 0; }
  h1, h2, h3, h4, h5, h6 { font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; margin: 1.4em 0 0.5em; break-after: avoid; }
  h1 { font-size: 22px; } h2 { font-size: 19px; } h3 { font-size: 16px; } h4, h5, h6 { font-size: 14.5px; }
  body > :first-child { margin-top: 0; }
  p { orphans: 3; widows: 3; }
  p, ul, ol, blockquote, pre, table { margin: 0 0 0.9em; }
  ul { list-style: disc; padding-left: 1.4em; } ol { list-style: decimal; padding-left: 1.6em; }
  li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.4em; }
  input[type="checkbox"] { margin: 0 0.5em 0 0; }
  a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
  strong { font-weight: 600; } del { color: #868B91; }
  code, pre { font-family: "Source Code Pro", ui-monospace, monospace; font-size: 12.5px; }
  code { background: #F1F4F6; padding: 0 3px; border-radius: 3px; }
  pre { background: #F1F4F6; padding: 10px 12px; border-radius: 6px; white-space: pre-wrap; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 2px solid #CCD0D3; padding-left: 12px; color: #5F6469; }
  /* Print tables run smaller and tighter than on screen, and long cell text
     wraps, so wide tables fit the page's text width. */
  table { border-collapse: collapse; font-size: 11.5px; line-height: 1.4; max-width: 100%; }
  th, td { border: 1px solid #CCD0D3; padding: 3px 6px; text-align: left; overflow-wrap: anywhere; }
  th { font-weight: 600; background: #F1F4F6; }
  tr { break-inside: avoid; }
  hr { border: none; border-top: 1px solid #CCD0D3; margin: 1.6em 0; }
  img { max-width: 100%; }
  pre, blockquote, figure, img, .jot-math-block, .jot-keep { break-inside: avoid; }
  /* Code colours, light values of the --code-* tokens (print is always light). */
  .code-keyword { color: #A83442; } .code-string { color: #0B7643; } .code-number { color: #7B6000; }
  .code-function { color: #0068B2; } .code-comment { color: #8A8F95; font-style: italic; }
  /* Diagrams (2h) and math, as in the rendered view. */
  .jot-diagram { margin: 0 0 0.9em; border: 1px solid #CCD0D3; border-radius: 8px; }
  .jot-diagram-body { padding: 14px; text-align: center; }
  .jot-diagram-body svg { max-width: 100%; max-height: 110mm; height: auto; }
  .jot-diagram figcaption { border-top: 1px solid #E6E8EA; padding: 5px 12px; font-family: "Source Code Pro", ui-monospace, monospace; font-size: 10px; color: #868B91; }
  .jot-diagram-error { padding: 8px 12px 0; font-family: "Source Code Pro", ui-monospace, monospace; font-size: 11px; color: #B32035; }
  .jot-math-block { margin: 0 0 0.9em; }
`

// Only what the page needs from the app's styles: the bundled fonts
// (offline) and KaTeX's rules. The app's own CSS stays out — it's written
// for the screen, and Paged.js parses every stylesheet it's given.
function printStyles(): string {
  const out: string[] = []
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule || (rule instanceof CSSStyleRule && rule.selectorText.includes('.katex'))) out.push(rule.cssText)
    }
  }
  return out.join('\n')
}

// Paged.js ignores "break-after: avoid", so a heading is bound to the block
// after it in a wrapper that can't break. Not when that block is a table —
// a long table must be free to continue onto the next page.
function keepHeadingsWithNext(doc: Document) {
  for (const h of [...doc.body.querySelectorAll(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6')]) {
    const next = h.nextElementSibling
    if (!next || next.tagName === 'TABLE' || /^H[1-6]$/.test(next.tagName)) continue
    const keep = doc.createElement('div')
    keep.className = 'jot-keep'
    h.before(keep)
    keep.append(h, next)
  }
}

interface PagedApi {
  Handler: new (...args: unknown[]) => object
  registerHandlers: (...handlers: unknown[]) => void
}

// A table continued onto a new page gets its header row again. Paged.js
// rebuilds the continued <table> itself without a hook, but each row laid
// into it passes renderNode — so the header goes in with the first one,
// before that row is measured, and its height counts toward the page.
function registerTableHeaders(win: Window) {
  const Paged = (win as Window & { Paged?: PagedApi }).Paged
  if (!Paged) return
  class RepeatTableHeaders extends Paged.Handler {
    renderNode(node: Node, source: Node) {
      // Nodes belong to the frame's realm, so no instanceof against ours.
      const el = (node.nodeType === 1 ? node : node.parentElement) as Element | null
      const table = el?.closest?.('table[data-split-from]')
      if (!table || table.querySelector(':scope > thead')) return
      const src = (source.nodeType === 1 ? source : source.parentElement) as Element | null
      const head = src?.closest?.('table')?.querySelector(':scope > thead')
      if (!head) return
      const copy = head.cloneNode(true) as Element
      for (const e of [copy, ...copy.querySelectorAll('[data-ref]')]) e.removeAttribute('data-ref')
      table.insertBefore(copy, table.firstChild)
    }
  }
  Paged.registerHandlers(RepeatTableHeaders)
}

// The Paged.js polyfill runs inside the print frame, so its page styles never
// touch the app. Referenced by path: the package exports only its main entry.
export async function exportPdf(title: string, content: string) {
  const [body, { default: pagedUrl }] = await Promise.all([renderHtml(content, { theme: 'light' }), import('../../node_modules/pagedjs/dist/paged.polyfill.min.js?url')])
  // Off-screen but laid out: Paged.js measures real boxes to paginate.
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:1000px;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  const win = frame.contentWindow! as Window & { PagedConfig?: object }
  const safeTitle = exportFilename(title, 'pdf').replace(/\.pdf$/, '').replace(/</g, '&lt;')
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>${printStyles()}</style><style>${printCss}</style></head><body>${body}</body></html>`)
  doc.close()
  keepHeadingsWithNext(doc)
  win.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 500))
  // Fonts first (Paged.js measures text), then paginate, then print.
  await (doc.fonts?.ready ?? Promise.resolve())
  win.PagedConfig = {
    auto: true,
    before: () => registerTableHeaders(win),
    after: () => {
      win.focus()
      win.print()
    },
  }
  const script = doc.createElement('script')
  script.src = pagedUrl
  doc.head.appendChild(script)
}
