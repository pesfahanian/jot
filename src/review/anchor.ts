// Verbatim-quote anchoring: model flags and section starts carry only the
// quoted text. A quote is found in the live document exactly; whitespace
// runs may differ (the model reflows soft line breaks), nothing else. A
// quote that can't be found returns null — the caller downgrades that flag
// to a comment-only note rather than drawing a broken highlight.

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export interface Range {
  start: number
  end: number
}

function occurrences(text: string, quote: string): Range[] {
  const q = quote.trim()
  if (!q) return []
  const out: Range[] = []
  let at = text.indexOf(q)
  while (at !== -1) {
    out.push({ start: at, end: at + q.length })
    at = text.indexOf(q, at + 1)
  }
  if (out.length) return out
  // Whitespace-tolerant fallback.
  const re = new RegExp(q.split(/\s+/).map(esc).join('\\s+'), 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length })
  if (out.length) return out
  return folded(text, q)
}

// Farsi fallback (Farsi support): models quoting Farsi drop or retype the
// half-space, swap Arabic ي / ك for Persian ی / ک, and drop the ezafe mark.
// Both sides are folded the same way — those characters and all whitespace
// removed, Arabic letters mapped to Persian — and a match maps back to the
// exact stretch of the original document.
const DROP = /[\s\u200c-\u200f\u0654]/u
const LETTER: Record<string, string> = { '\u064a': '\u06cc', '\u0649': '\u06cc', '\u0643': '\u06a9' }
function fold(s: string): { text: string; at: number[] } {
  let text = ''
  const at: number[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (DROP.test(c)) continue
    text += LETTER[c] ?? c
    at.push(i)
  }
  return { text, at }
}
function folded(text: string, quote: string): Range[] {
  const q = fold(quote).text
  if (q.length < 2) return []
  const t = fold(text)
  const out: Range[] = []
  let i = t.text.indexOf(q)
  while (i !== -1) {
    out.push({ start: t.at[i], end: t.at[i + q.length - 1] + 1 })
    i = t.text.indexOf(q, i + 1)
  }
  return out
}

// When the same text occurs more than once, the first occurrence not
// already claimed by another flag wins, in document order
// (open-decisions #7). `near` prefers the occurrence closest to a known
// position (used when re-anchoring a resumed review).
export function anchorQuote(text: string, quote: string, claimed: Range[] = [], near?: number): Range | null {
  const all = occurrences(text, quote)
  if (!all.length) return null
  const free = all.filter((r) => !claimed.some((c) => c.start === r.start && c.end === r.end))
  const pool = free.length ? free : all
  if (near === undefined) return pool[0]
  return pool.reduce((a, b) => (Math.abs(b.start - near) < Math.abs(a.start - near) ? b : a))
}
