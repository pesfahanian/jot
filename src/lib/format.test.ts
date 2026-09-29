import { describe, expect, it } from 'vitest'
import { formatMarkdown, minimalChange, starEmphasis } from './format'

describe('markdown formatting (house style)', () => {
  it('uses - bullets, * emphasis, aligned tables, and never rewraps lines', async () => {
    const long = 'A long line that should stay exactly as long as it is, however far past eighty characters it happens to run on.'
    const out = await formatMarkdown(`#  Title\n* one\n* two\n\n_soft_ and __strong__\n\n|a|bb|\n|-|-|\n|ccc|d|\n\n${long}\n`)
    expect(out).toContain('# Title\n')
    expect(out).toContain('- one\n- two')
    expect(out).toContain('*soft* and **strong**')
    expect(out).toContain('| a   | bb  |')
    expect(out).toContain(long)
  })

  it('leaves code in fences untouched', async () => {
    const code = '```js\nconst   x={a:1}\n```\n'
    expect(await formatMarkdown(code)).toBe(code)
  })

  it('only swaps real emphasis markers', () => {
    expect(starEmphasis('_a_ snake_case `_x_` [l](http://a_b_c)')).toBe('*a* snake_case `_x_` [l](http://a_b_c)')
  })

  it('computes the smallest replacement', () => {
    expect(minimalChange('abcXdef', 'abcYYdef')).toEqual({ from: 3, to: 4, insert: 'YY' })
    expect(minimalChange('same', 'same')).toBeNull()
  })
})
