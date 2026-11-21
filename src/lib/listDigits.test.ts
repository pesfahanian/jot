import { describe, expect, it } from 'vitest'
import { asciiListNumbers } from './listDigits'

describe('asciiListNumbers', () => {
  it('reads Persian and Arabic-Indic list numbers as 0–9, one digit for one', () => {
    const md = '۱. اول\n۲. دوم\n۱۲) دوازدهم\n١. عربي'
    const out = asciiListNumbers(md)
    expect(out).toBe('1. اول\n2. دوم\n12) دوازدهم\n1. عربي')
    expect(out.length).toBe(md.length)
  })
  it('takes them indented and inside quotes', () => {
    expect(asciiListNumbers('  ۳. سه\n> ۴. چهار')).toBe('  3. سه\n> 4. چهار')
  })
  it('leaves digits that are not a list number alone', () => {
    const md = 'ساعت ۹ و ۱۶.\n۱.۵ کیلو\n۱۴۰۵\nمثلاً ۲. نه'
    expect(asciiListNumbers(md)).toBe(md)
  })
  it('leaves fenced code as written', () => {
    const md = '```\n۱. کد\n```\n۱. فهرست'
    expect(asciiListNumbers(md)).toBe('```\n۱. کد\n```\n1. فهرست')
  })
})
