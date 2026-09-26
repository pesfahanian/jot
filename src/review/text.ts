import { markdownLanguage } from '@codemirror/lang-markdown'
import type { SyntaxNode } from '@lezer/common'

// Prose structure for Pass A. Every offset here is an offset into the
// original document, so client-side flags carry exact positions.

export type BlockKind = 'heading' | 'paragraph' | 'listItem'

export interface Block {
  kind: BlockKind
  from: number
  to: number
  // For list items: which list they belong to and their order in it.
  listId?: number
  // Index of the markdown heading section (split at headings) — used by the
  // section-scoped rules that don't depend on mode (T1-09).
  headingSection: number
  // True for the first prose block of the document or after a heading —
  // "section start" for first-word fingerprints (T1-06).
  sectionStart: boolean
}

export interface Sentence {
  from: number
  to: number
  words: number
  block: Block
}

export interface Prose {
  text: string
  // The document with code, URLs and link targets blanked to spaces (same
  // length, same newlines), so pattern rules never fire inside code.
  masked: string
  blocks: Block[]
  sentences: Sentence[]
  words: number
}

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu
export const countWords = (s: string) => (s.match(WORD) ?? []).length

// Sentence ends: . ! ? (with closing quotes/brackets) followed by space or
// end of block. Common abbreviations don't end a sentence.
const ABBREV = /\b(e\.g|i\.e|etc|vs|mr|mrs|ms|dr|approx|no|fig|cf)\.$/i

function splitSentences(masked: string, block: Block): Sentence[] {
  const out: Sentence[] = []
  const re = /[.!?]+["')\]]*(?=\s|$)/g
  const text = masked.slice(block.from, block.to)
  let start = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length
    if (ABBREV.test(text.slice(Math.max(0, m.index - 6), m.index + 1))) continue
    // A decimal or version number ("v1.2") isn't a sentence end.
    if (/\d$/.test(text.slice(0, m.index)) && /^\d/.test(text.slice(end))) continue
    pushSentence(text, start, end)
    start = end
  }
  pushSentence(text, start, text.length)
  return out

  function pushSentence(t: string, a: number, b: number) {
    const lead = t.slice(a, b).search(/\S/)
    if (lead === -1) return
    const from = a + lead
    const to = a + t.slice(a, b).trimEnd().length
    const words = countWords(t.slice(from, to))
    if (words > 0) out.push({ from: block.from + from, to: block.from + to, words, block })
  }
}

export function analyzeProse(text: string): Prose {
  const tree = markdownLanguage.parser.parse(text)
  const chars = text.split('')
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (chars[i] !== '\n') chars[i] = ' '
  }
  const blocks: Block[] = []
  let headingSection = 0
  let sectionStart = true
  let listSeq = 0

  function visit(node: SyntaxNode, listId?: number) {
    for (let c = node.firstChild; c; c = c.nextSibling) {
      const name = c.name
      if (name === 'FencedCode' || name === 'CodeBlock' || name === 'HTMLBlock' || name === 'CommentBlock' || name === 'Table') {
        blank(c.from, c.to)
        continue
      }
      if (/^(ATX|Setext)Heading/.test(name)) {
        headingSection++
        maskInline(c)
        const mark = c.getChild('HeaderMark')
        const from = mark && mark.from === c.from ? skipSpace(mark.to) : c.from
        blocks.push({ kind: 'heading', from, to: c.to, headingSection, sectionStart: false })
        sectionStart = true
        continue
      }
      if (name === 'Paragraph') {
        maskInline(c)
        blocks.push({ kind: listId !== undefined ? 'listItem' : 'paragraph', from: c.from, to: c.to, listId, headingSection, sectionStart })
        sectionStart = false
        continue
      }
      if (name === 'BulletList' || name === 'OrderedList') {
        const id = ++listSeq
        for (let item = c.firstChild; item; item = item.nextSibling) {
          if (item.name !== 'ListItem') continue
          const mark = item.getChild('ListMark')
          if (mark) blank(mark.from, mark.to)
          const task = item.getChild('Task')
          if (task) {
            const tm = task.getChild('TaskMarker')
            if (tm) blank(tm.from, tm.to)
            maskInline(task)
            blocks.push({ kind: 'listItem', from: tm ? skipSpace(tm.to) : task.from, to: task.to, listId: id, headingSection, sectionStart })
            sectionStart = false
          }
          visit(item, id)
        }
        continue
      }
      if (name === 'Blockquote') {
        for (const q of c.getChildren('QuoteMark')) blank(q.from, q.to)
        visit(c, listId)
        continue
      }
      if (name === 'ListItem' || name === 'Document') visit(c, listId)
    }
  }

  // Inline code, URLs, link targets, images and raw HTML are not prose.
  function maskInline(node: SyntaxNode) {
    node.toTree().iterate({
      enter: (n) => {
        const from = node.from + n.from
        const to = node.from + n.to
        if (n.name === 'InlineCode' || n.name === 'URL' || n.name === 'HTMLTag' || n.name === 'Autolink' || n.name === 'Image' || n.name === 'LinkTitle') {
          blank(from, to)
          return false
        }
        return undefined
      },
    })
  }

  function skipSpace(at: number) {
    while (at < text.length && (text[at] === ' ' || text[at] === '\t')) at++
    return at
  }

  visit(tree.topNode)
  const masked = chars.join('')
  const sentences = blocks.flatMap((b) => splitSentences(masked, b))
  return { text, masked, blocks, sentences, words: sentences.reduce((n, s) => n + s.words, 0) }
}

// Byte-for-byte word boundaries around a match, for spans that include "the
// following word" (T1-03, T1-06, and the T1b-05/T1b-06 fallbacks).
export function nextWord(text: string, at: number): { from: number; to: number } | null {
  const rest = text.slice(at)
  const m = rest.match(/^[\s,;:—-]*([\p{L}\p{N}][\p{L}\p{N}'’-]*)/u)
  if (!m) return null
  const from = at + m[0].length - m[1].length
  return { from, to: from + m[1].length }
}

export const capitalize = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w)
