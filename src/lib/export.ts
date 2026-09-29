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
// the rendered pane uses): markdown → HTML, set in the rendered-pane
// typography (§1.8), then the browser's own print-to-PDF.

const printCss = `
  @page { margin: 22mm 20mm; }
  html, body { background: #fff !important; }
  body { font-family: "Public Sans", Helvetica, sans-serif; font-size: 14.5px; line-height: 1.58; color: #25292F; max-width: 520px; margin: 0 auto; }
  h1, h2, h3, h4, h5, h6 { font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; margin: 1.4em 0 0.5em; }
  h1 { font-size: 22px; } h2 { font-size: 19px; } h3, h4, h5, h6 { font-size: 16px; }
  p, ul, ol, blockquote, pre, table { margin: 0 0 0.9em; }
  a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
  code, pre { font-family: "Source Code Pro", ui-monospace, monospace; font-size: 12.5px; }
  code { background: #F1F4F6; padding: 0 3px; border-radius: 3px; }
  pre { background: #F1F4F6; padding: 10px 12px; border-radius: 6px; white-space: pre-wrap; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 2px solid #CCD0D3; padding-left: 12px; color: #5F6469; }
  table { border-collapse: collapse; } th, td { border: 1px solid #CCD0D3; padding: 4px 8px; text-align: left; }
  hr { border: none; border-top: 1px solid #CCD0D3; }
  img { max-width: 100%; }
  /* Code colours, light values of the --code-* tokens (print is always light). */
  .code-keyword { color: #A83442; } .code-string { color: #0B7643; } .code-number { color: #7B6000; }
  .code-function { color: #0068B2; } .code-comment { color: #8A8F95; font-style: italic; }
`

export async function exportPdf(title: string, content: string) {
  const body = await renderHtml(content)
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  const safeTitle = exportFilename(title, 'pdf').replace(/\.pdf$/, '').replace(/</g, '&lt;')
  // The app's own stylesheets carry the bundled @font-face rules (offline);
  // printCss after them resets everything that matters for the page.
  const fonts = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('')
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>${fonts}<style>${printCss}</style></head><body>${body}</body></html>`)
  doc.close()
  const win = frame.contentWindow!
  const cleanup = () => setTimeout(() => frame.remove(), 500)
  win.addEventListener('afterprint', cleanup)
  // Let the fonts land before the print snapshot.
  void (doc.fonts?.ready ?? Promise.resolve()).then(() => {
    win.focus()
    win.print()
  })
}
