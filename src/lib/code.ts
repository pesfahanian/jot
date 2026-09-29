import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { tags as t, type Tag } from '@lezer/highlight'

// Code colouring shared by the editor and the renderer (Phase 7), so a code
// block looks the same typed, rendered and printed.

// The language a fence names (```js, ```python …), from CodeMirror's
// catalogue; its grammar loads on first use.
export function findCodeLanguage(info: string | undefined): LanguageDescription | null {
  const name = info?.trim().split(/\s+/)[0]
  return name ? LanguageDescription.matchLanguageName(languages, name, true) : null
}

// Five colour groups, each a --code-* token (index.css). Anything else —
// plain names, operators, punctuation — stays in the ink.
export const CODE_GROUPS: { name: 'keyword' | 'string' | 'number' | 'function' | 'comment'; tags: Tag[] }[] = [
  { name: 'keyword', tags: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.modifier, t.self, t.tagName] },
  { name: 'string', tags: [t.string, t.special(t.string), t.regexp, t.character] },
  { name: 'number', tags: [t.number, t.bool, t.null, t.atom, t.typeName, t.className, t.namespace, t.unit] },
  {
    name: 'function',
    tags: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName)), t.propertyName, t.attributeName, t.macroName],
  },
  { name: 'comment', tags: [t.comment, t.lineComment, t.blockComment, t.docComment, t.meta] },
]
