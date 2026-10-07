import { describe, expect, it } from 'vitest'
import { declineReason, MIN_PROSE_WORDS, proseWords, reviewLanguage } from './suitability'

// The review declines text there's nothing to judge in: too little prose,
// or only code. Code, math and links don't count as prose.

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}`).join(' ')

describe('proseWords', () => {
  it('counts words of prose only', () => {
    expect(proseWords('# Title\n\nSome plain text here.')).toBe(5)
    expect(proseWords('Run `npm install` then see https://example.com/docs today.')).toBe(4)
    expect(proseWords('Text.\n\n```py\ndef f(x):\n    return x\n```\n\nMore.')).toBe(2)
    expect(proseWords('---\ntitle: x\n---\nBody words.')).toBe(2)
    expect(proseWords('$$\n\\sum_{i=1}^n i\n$$\nDone.')).toBe(1)
  })

  it('counts any script', () => {
    expect(proseWords('این یک متن است')).toBe(4)
  })

  it('treats an unclosed fence as code to the end', () => {
    expect(proseWords('Intro.\n```\nlet a = b\nmore code')).toBe(1)
  })
})

describe('declineReason', () => {
  it('lets a document with enough prose through', () => {
    expect(declineReason(words(MIN_PROSE_WORDS))).toBeNull()
    expect(declineReason(`${words(MIN_PROSE_WORDS)}\n\n\`\`\`js\n${'x()\n'.repeat(200)}\`\`\``)).toBeNull()
  })

  it('declines very short text, saying how short', () => {
    expect(declineReason('Just a line.')).toBe(`too short: 3 words of prose, a review needs ${MIN_PROSE_WORDS}`)
    expect(declineReason('Hi')).toBe(`too short: 1 word of prose, a review needs ${MIN_PROSE_WORDS}`)
  })

  it('declines a document that is all code', () => {
    expect(declineReason('```ts\nconst a = 1\n```')).toBe('only code, no prose to review')
    expect(declineReason('--- *** ---')).toBe('no prose to review')
  })
})

describe('reviewLanguage', () => {
  it('sends a Farsi document — English terms, code and links included — to the Farsi guide', () => {
    expect(reviewLanguage('React یک کتابخانه است که برای ساختن رابط کاربری به کار می‌رود. دستور `npm install react --save` را اجرا کنید و https://react.dev/learn را بخوانید.')).toBe('fa')
  })
  it('keeps an English document with a Farsi phrase on the English guide', () => {
    expect(reviewLanguage('The Farsi word for library is «کتابخانه», and it names this whole section of the guide.')).toBe('en')
  })
})
