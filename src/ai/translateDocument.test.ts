import { describe, expect, it } from 'vitest'
import { parseTranslation, sections } from './translateDocument'

describe('full translation', () => {
  it('splits by heading, never inside code, and rejoins exactly', () => {
    const text = '# One\n\nfirst\n\n```js\n# not a heading\n```\n\n## Two\n\nsecond'
    const s = sections(text)
    expect(s).toEqual(['# One\n\nfirst\n\n```js\n# not a heading\n```\n', '## Two\n\nsecond'])
    expect(s.join('\n')).toBe(text)
  })
  it('batches paragraphs when a section is long, and still rejoins exactly', () => {
    const para = 'word '.repeat(120).trim()
    const text = Array.from({ length: 8 }, () => para).join('\n\n')
    const s = sections(text)
    expect(s.length).toBeGreaterThan(1)
    expect(s.join('\n')).toBe(text)
  })
  it('reads the translation, or the reply as it is', () => {
    expect(parseTranslation('{"translation": "# یک\\n\\nاول"}')).toBe('# یک\n\nاول')
    expect(parseTranslation('```markdown\n# Uno\n```')).toBe('# Uno')
  })
})
