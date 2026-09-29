import { markdownLanguage } from '@codemirror/lang-markdown'

// Markdown formatting (Phase 8, Cmd+Shift+I / Shift+Option+F): Prettier's
// markdown formatter, run in the browser and loaded on first use. House
// style (owner): never rewrap lines, "-" bullets, "*" emphasis, tables
// aligned into columns. Code inside fences is left exactly as written.

export async function formatMarkdown(text: string): Promise<string> {
  const [{ format }, markdown] = await Promise.all([import('prettier/standalone'), import('prettier/plugins/markdown')])
  const out = await format(text, {
    parser: 'markdown',
    plugins: [markdown],
    proseWrap: 'preserve',
    embeddedLanguageFormatting: 'off',
    tabWidth: 2,
  })
  return starEmphasis(out)
}

// Prettier writes emphasis as _text_ with no option to change it; the house
// style is *text*. Swapped through the markdown parse, so only real
// emphasis markers change — never an underscore in a word, a URL or code.
export function starEmphasis(md: string): string {
  const swaps: number[] = []
  markdownLanguage.parser.parse(md).iterate({
    enter(node) {
      if (node.name !== 'Emphasis') return
      for (const mark of node.node.getChildren('EmphasisMark')) if (md.slice(mark.from, mark.to) === '_') swaps.push(mark.from)
    },
  })
  if (!swaps.length) return md
  const chars = md.split('')
  for (const at of swaps) chars[at] = '*'
  return chars.join('')
}

// The smallest single replacement turning `before` into `after` — keeps the
// cursor and scroll steady when formatting changes only part of the text.
export function minimalChange(before: string, after: string): { from: number; to: number; insert: string } | null {
  if (before === after) return null
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  let endB = before.length
  let endA = after.length
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--
    endA--
  }
  return { from: start, to: endB, insert: after.slice(start, endA) }
}
