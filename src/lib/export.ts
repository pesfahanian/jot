import { directionOf, type DirSetting } from './direction'
import { PDF_DEFAULTS, pdfCss, type PdfOptions } from './pdfOptions'
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

// Plain text is the document exactly as written, markdown included, under a
// .txt name (owner, open-decisions #10).
export function exportPlainText(title: string, content: string) {
  download(exportFilename(title, 'txt'), content, 'text/plain;charset=utf-8')
}

// PDF goes through the renderer (6a's note, lib/render.ts — the same one
// the rendered view uses): markdown → HTML, laid out into real pages by
// Paged.js (Phase 9), then the browser's own print-to-PDF. Page, margins,
// font, size, preset, page numbers and custom CSS come from the PDF options
// card (lib/pdfOptions.ts). No code block, diagram, formula, quote or table
// row is split across a page break; a table taller than a page continues
// between rows with its header row repeated; a heading always travels with
// what follows it. Tuned against docs/benchmarks/pdf-benchmark.md and
// docs/benchmarks/farsi-mixed.md.

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
export async function exportPdf(title: string, content: string, options: PdfOptions = PDF_DEFAULTS, dir: DirSetting = 'auto') {
  const [body, { default: pagedUrl }] = await Promise.all([renderHtml(content, { theme: 'light', dir }), import('../../node_modules/pagedjs/dist/paged.polyfill.min.js?url')])
  // A document that reads right-to-left as a whole numbers its pages in
  // Persian digits (Farsi design, frame 8).
  const rtl = dir === 'rtl' || (dir === 'auto' && directionOf(content) === 'rtl')
  const printCss = pdfCss(options, rtl)
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
