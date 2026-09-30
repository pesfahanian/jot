import type { MarkedExtension, Tokens } from 'marked'

// LaTeX-style math (Phase 9), rendered by KaTeX in the rendered view and the
// PDF: $…$ inline, $$…$$ as a block (on its own lines, or inline for a
// displayed formula mid-paragraph). KaTeX and its stylesheet load only when
// a document has a $ in it.
//
// Inline math follows Pandoc's rule so prices don't turn into formulas: the
// opening $ can't be followed by a space, the closing $ can't be preceded by
// one or followed by a digit — "$5 and $10" stays text.

type Katex = typeof import('katex').default
let katex: Katex | null = null
let loading: Promise<void> | undefined

export function loadMath(md: string): Promise<void> {
  if (katex || !md.includes('$')) return Promise.resolve()
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => {
    katex = m.default
  })
  return loading
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function render(tex: string, display: boolean): string {
  if (!katex) return escape(display ? `$$${tex}$$` : `$${tex}$`)
  // Errors render in place (red, with the source) rather than throwing, and
  // no \href / \url or other trust-gated commands are honoured.
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', trust: false, strict: 'ignore' })
}

interface MathToken extends Tokens.Generic {
  text: string
  display: boolean
}

export const mathExtension: MarkedExtension = {
  extensions: [
    {
      name: 'mathBlock',
      level: 'block',
      start: (src) => src.match(/^\$\$/m)?.index,
      tokenizer(src) {
        const m = /^\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$[ \t]*(?:\n+|$)/.exec(src)
        if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim(), display: true } as MathToken
      },
      renderer: (token) => `<div class="jot-math-block">${render((token as MathToken).text, true)}</div>\n`,
    },
    {
      name: 'mathInline',
      level: 'inline',
      start: (src) => src.indexOf('$') === -1 ? undefined : src.indexOf('$'),
      tokenizer(src) {
        const display = /^\$\$(?!\s)([^$]+?)(?<!\s)\$\$/.exec(src)
        if (display) return { type: 'mathInline', raw: display[0], text: display[1], display: true } as MathToken
        const m = /^\$(?![\s$])((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/.exec(src)
        if (m) return { type: 'mathInline', raw: m[0], text: m[1], display: false } as MathToken
      },
      renderer: (token) => render((token as MathToken).text, (token as MathToken).display),
    },
  ],
}
