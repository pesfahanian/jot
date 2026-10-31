import { describe, expect, it } from 'vitest'
import { titleFromContent } from './autoTitle'

describe('titles from the first line', () => {
  it('strips markdown marks', () => {
    expect(titleFromContent('# Quarterly **plan**\n\nbody')).toBe('Quarterly plan')
    expect(titleFromContent('- [ ] buy [milk](https://x.y) and `eggs`')).toBe('buy milk and eggs')
    expect(titleFromContent('> a quoted _first_ line')).toBe('a quoted first line')
    expect(titleFromContent('snake_case stays')).toBe('snake_case stays')
  })
  it('skips blank lines, rules, fences and their code', () => {
    expect(titleFromContent('\n\n---\n```js\nconst x = 1\n```\nReal title')).toBe('Real title')
  })
  it('works for Farsi', () => {
    expect(titleFromContent('## گزارش هفتگی\n\nمتن')).toBe('گزارش هفتگی')
  })
  it('has no title without words, and cuts long lines at a word', () => {
    expect(titleFromContent('')).toBeNull()
    expect(titleFromContent('#\n---\n* * *')).toBeNull()
    const long = titleFromContent('word '.repeat(30))!
    expect(long.length).toBeLessThanOrEqual(60)
    expect(long.endsWith('word')).toBe(true)
  })
  it('keeps a slash out (it would be a folder in the backup)', () => {
    expect(titleFromContent('notes on a/b testing')).toBe('notes on a-b testing')
  })
})
