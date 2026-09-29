import { markdownLanguage } from '@codemirror/lang-markdown'
import { Language, ParseContext } from '@codemirror/language'
import { styleTags, tags as t } from '@lezer/highlight'
import { parseCode, type MarkdownParser } from '@lezer/markdown'
import { findCodeLanguage } from '@/lib/code'

// Code colouring inside fenced blocks (Phase 7): the language named after
// the backticks (```js, ```python, …) parses the block's text. Grammars come
// from CodeMirror's catalogue and load on first use only — until one has
// loaded, its block shows as plain code, then colours in place.
//
// Built by hand rather than with lang-markdown's markdown() helper, which
// would also bundle HTML/CSS/JS grammars up front and add its own keymap.


const codeParser = (info: string) => {
  const desc = findCodeLanguage(info)
  if (!desc) return null
  return desc.support ? desc.support.language.parser : ParseContext.getSkippingParser(desc.load())
}

// Same language data as markdownLanguage, so everything keyed to it (list
// continuation, the review's text masking) treats it as markdown.
export const markdownWithCode = new Language(
  markdownLanguage.data,
  (markdownLanguage.parser as MarkdownParser).configure([
    parseCode({ codeParser }),
    // A block with no (or an unknown) language is plain ink, as rendered —
    // not the inline-code green over the whole block. Inline code keeps it.
    { props: [styleTags({ 'FencedCode/CodeText CodeBlock/CodeText': t.content })] },
  ]),
  [],
  'markdown',
)
