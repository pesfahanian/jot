import { describe, expect, it } from 'vitest'
import { blocksOf, directionOf, hasRtl, lineDirections } from './direction'

// The one direction function the editor, the rendered view and the PDF
// share (owner decisions + the Farsi design's pushbacks).

describe('directionOf — majority script, not first letter', () => {
  it('reads a Farsi sentence that starts with an English word as right-to-left', () => {
    expect(directionOf('React یک کتابخانه است که برای ساختن رابط کاربری به کار می‌رود.')).toBe('rtl')
  })
  it('reads an English sentence with a Farsi phrase as left-to-right', () => {
    expect(directionOf('The Farsi word for library is «کتابخانه», and it names this whole section.')).toBe('ltr')
  })
  it("doesn't let code, URLs, link targets or math vote", () => {
    expect(directionOf('برای نصب `npm install react --save-dev` را اجرا کنید')).toBe('rtl')
    expect(directionOf('راهنما را در [اینجا](https://react.dev/learn/thinking-in-react) بخوانید')).toBe('rtl')
    expect(directionOf('طبق قضیه $a^2 + b^2 = c^2 + something + more$ است')).toBe('rtl')
  })
  it('has no opinion without letters', () => {
    expect(directionOf('---')).toBeNull()
    expect(directionOf('1. 2. 3.')).toBeNull()
    expect(directionOf('`code only`')).toBeNull()
  })
  it('knows when there is any Farsi at all', () => {
    expect(hasRtl('plain English')).toBe(false)
    expect(hasRtl('one word: سلام')).toBe(true)
    expect(hasRtl('only in code: `سلام`')).toBe(false)
  })
})

describe('blocks', () => {
  it('keeps a loose list, a quote and a table each as one block', () => {
    const md = ['- one', '', '- two', '  more', '', '> a', '> b', '', '| a | b |', '|---|---|', '| 1 | 2 |'].join('\n')
    expect(blocksOf(md.split('\n')).map((b) => `${b.kind}:${b.from}-${b.to}`)).toEqual(['list:0-3', 'quote:5-6', 'para:8-10'])
  })
  it('ends a quote at a blank line, and starts a new list at a new bullet', () => {
    const md = ['> a', '', '> b', '', '- one', '', '- two', '', '* three', '1. four', '1) five'].join('\n')
    expect(blocksOf(md.split('\n')).map((b) => `${b.kind}:${b.from}-${b.to}`)).toEqual(['quote:0-0', 'quote:2-2', 'list:4-6', 'list:8-8', 'list:9-9', 'list:10-10'])
  })
  it('treats fenced code and math blocks as their own blocks', () => {
    const md = ['text', '```js', 'x', '```', '$$', 'a', '$$', '$$ b $$'].join('\n')
    expect(blocksOf(md.split('\n')).map((b) => `${b.kind}:${b.from}-${b.to}`)).toEqual(['para:0-0', 'code:1-3', 'math:4-6', 'math:7-7'])
  })
})

describe('lineDirections', () => {
  it('gives a whole list one direction, even with an English item', () => {
    const md = ['- کامپوننت‌ها قطعه‌های مستقل رابط هستند', '- `props`', '- React'].join('\n')
    expect(lineDirections(md)).toEqual(['rtl', 'rtl', 'rtl'])
  })
  it('gives an English quote or list after a Farsi one its own direction', () => {
    const md = ['> نقل‌قول فارسی', '', '> An English quote', '', '- مورد فارسی', '', '* An English list'].join('\n')
    expect(lineDirections(md)).toEqual(['rtl', 'rtl', 'ltr', 'ltr', 'rtl', 'rtl', 'ltr'])
  })
  it('lets a block with no letters inherit from the one before', () => {
    const md = ['# راهنمای انتشار', '', '---', '', '12345'].join('\n')
    expect(lineDirections(md)).toEqual(['rtl', 'rtl', 'rtl', 'rtl', 'rtl'])
  })
  it('keeps fenced code left-to-right inside a Farsi section, without passing it on', () => {
    const md = ['## نمونه', '```js', 'return `سلام ${name}`', '```', '1.5'].join('\n')
    expect(lineDirections(md)).toEqual(['rtl', 'ltr', 'ltr', 'ltr', 'rtl'])
  })
  it('switches block by block in a mixed document', () => {
    const md = ['## کتابخانه‌ها', '', 'The Farsi word for library is «کتابخانه».', '', 'خروجی این تابع یک خوشامدگویی ساده است.'].join('\n')
    expect(lineDirections(md)).toEqual(['rtl', 'rtl', 'ltr', 'ltr', 'rtl'])
  })
  it('follows the per-document override, except for code and math', () => {
    const md = ['English text', '```', 'code', '```', 'متن'].join('\n')
    expect(lineDirections(md, 'rtl')).toEqual(['rtl', 'ltr', 'ltr', 'ltr', 'rtl'])
    expect(lineDirections(md, 'ltr')).toEqual(['ltr', 'ltr', 'ltr', 'ltr', 'ltr'])
  })
  it('reads an unclosed fence as code to the end', () => {
    expect(lineDirections(['متن', '```', 'still code'].join('\n'))).toEqual(['rtl', 'ltr', 'ltr'])
  })
})
