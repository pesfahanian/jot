// Text direction for mixed Farsi / English documents (Farsi support; docs/
// todo.md, research in docs/research/farsi-2026-10.md). One function decides
// the direction of every block, so the editor, the rendered view and the PDF
// always agree.
//
// Decided with the owner:
// - by block, not by line: a paragraph, a heading, a whole list, a whole
//   blockquote, a whole table each take one direction;
// - by majority script, not first letter: "React یک کتابخانه است" is
//   right-to-left;
// - markdown marks, inline code, URLs, link targets and math don't vote;
// - a block with no letters to go on (a rule, a number, a lone link) takes
//   the previous block's direction;
// - fenced code and math blocks are always left-to-right and don't pass
//   their direction on;
// - a per-document override (auto / rtl / ltr) forces every other block.

export type Dir = 'ltr' | 'rtl'
export type DirSetting = 'auto' | Dir

// Right-to-left scripts. Farsi is Arabic script; Hebrew comes along free.
const RTL_LETTER = /[\p{Script=Arabic}\p{Script=Hebrew}]/u
const LETTER = /\p{L}/u

// What doesn't vote: inline code, autolinks and bare URLs, link and image
// targets, inline math, HTML tags.
function voting(text: string): string {
  return text
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\$\$[^$]*\$\$|\$[^$\n]+\$/g, ' ')
    .replace(/\]\([^)\s]*(?:\s+"[^"]*")?\)/g, '] ')
    .replace(/<[^>\n]+>/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/g, ' ')
}

// Letters of each direction, counted.
export function scriptCounts(text: string): { rtl: number; ltr: number } {
  let rtl = 0
  let ltr = 0
  for (const ch of voting(text)) {
    if (RTL_LETTER.test(ch)) rtl++
    else if (LETTER.test(ch)) ltr++
  }
  return { rtl, ltr }
}

// The direction a stretch of text asks for, or null when it has no letters
// to decide by. Ties go left-to-right.
export function directionOf(text: string): Dir | null {
  const { rtl, ltr } = scriptCounts(text)
  if (!rtl && !ltr) return null
  return rtl > ltr ? 'rtl' : 'ltr'
}

// Whether a text contains any right-to-left letters at all (the status
// bar's dir cell shows only then).
export const hasRtl = (text: string) => RTL_LETTER.test(voting(text))

// ---- blocks ----

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const HEADING = /^ {0,3}#{1,6}(\s|$)/
const LIST_ITEM = /^ {0,3}([-*+]|\d{1,9}[.)])(\s|$)/
const QUOTE = /^ {0,3}>/
const MATH = /^ {0,3}\$\$/
const BLANK = /^\s*$/

// A list item's type: its bullet character, or the ordered delimiter.
function markerOf(line: string): string {
  const m = line.match(LIST_ITEM)
  return m ? (/\d/.test(m[1]) ? m[1].slice(-1) : m[1]) : ''
}

type Kind = 'code' | 'math' | 'heading' | 'list' | 'quote' | 'para' | 'front'

interface Block {
  kind: Kind
  from: number // first line, 0-based
  to: number // last line, inclusive
}

// Splits markdown into top-level blocks by line. A list runs on across
// blank lines while the next line still belongs to it, so a loose list stays
// one block; as in markdown, a different bullet (or `1)` after `1.`) starts
// a new list, and a blank line ends a blockquote.
export function blocksOf(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1)
    if (end > 0) {
      blocks.push({ kind: 'front', from: 0, to: end })
      i = end + 1
    }
  }
  while (i < lines.length) {
    const line = lines[i]
    if (BLANK.test(line)) {
      i++
      continue
    }
    const fence = line.match(FENCE)
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence[1][0] === '`' ? '`' : '~'}{${fence[1].length},}\\s*$`)
      let j = i + 1
      while (j < lines.length && !close.test(lines[j])) j++
      blocks.push({ kind: 'code', from: i, to: Math.min(j, lines.length - 1) })
      i = j + 1
      continue
    }
    if (MATH.test(line)) {
      // $$…$$ on one line, or opening a block that closes with $$.
      let j = line.trim().slice(2).includes('$$') ? i : i + 1
      while (j < lines.length && j > i && !/\$\$\s*$/.test(lines[j])) j++
      blocks.push({ kind: 'math', from: i, to: Math.min(j, lines.length - 1) })
      i = j + 1
      continue
    }
    if (HEADING.test(line)) {
      blocks.push({ kind: 'heading', from: i, to: i })
      i++
      continue
    }
    const kind: Kind = LIST_ITEM.test(line) ? 'list' : QUOTE.test(line) ? 'quote' : 'para'
    const marker = kind === 'list' ? markerOf(line) : ''
    // A top-level item of another list type starts a new list.
    const otherList = (l: string) => LIST_ITEM.test(l) && markerOf(l) !== marker
    let j = i + 1
    for (; j < lines.length; j++) {
      const next = lines[j]
      if (FENCE.test(next) || HEADING.test(next)) break
      if (BLANK.test(next)) {
        // A blank line ends a paragraph or a quote; a list continues if the
        // next non-blank line still belongs to it.
        if (kind !== 'list') break
        let k = j + 1
        while (k < lines.length && BLANK.test(lines[k])) k++
        const after = lines[k]
        const continues = after !== undefined && ((LIST_ITEM.test(after) && !otherList(after)) || /^\s{2,}\S/.test(after))
        if (!continues) break
        j = k - 1
        continue
      }
      if (kind === 'para' && (LIST_ITEM.test(next) || QUOTE.test(next))) break
      if (kind === 'quote' && !QUOTE.test(next)) break
      if (kind === 'list' && otherList(next)) break
    }
    blocks.push({ kind, from: i, to: j - 1 })
    i = j
  }
  return blocks
}

// The direction of every line: one entry per line of the document. Lines
// between blocks (blank ones) take the direction of the block before them,
// so the caret on an empty line sits where the text around it reads from.
export function lineDirections(md: string, setting: DirSetting = 'auto'): Dir[] {
  const lines = md.split('\n')
  const out: Dir[] = new Array(lines.length).fill('ltr')
  let carry: Dir = 'ltr'
  let at = 0
  for (const b of blocksOf(lines)) {
    for (; at < b.from; at++) out[at] = carry
    let dir: Dir
    if (b.kind === 'code' || b.kind === 'math' || b.kind === 'front') dir = 'ltr'
    else if (setting !== 'auto') dir = setting
    else dir = directionOf(lines.slice(b.from, b.to + 1).join('\n')) ?? carry
    for (let l = b.from; l <= b.to; l++) out[l] = dir
    if (b.kind !== 'code' && b.kind !== 'math' && b.kind !== 'front') carry = dir
    at = b.to + 1
  }
  for (; at < lines.length; at++) out[at] = carry
  return out
}
