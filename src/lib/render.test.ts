import { describe, expect, it } from 'vitest'
import { renderBlocks, renderHtml } from './render'

// Each rendered block must know the source line it starts on — scroll sync
// maps editor lines to rendered positions through these anchors.

const md = ['# Title', '', 'First para', 'wraps here.', '', '- a', '- b', '', '```js', 'x()', '```', '', '| h |', '| - |', '| c |', '', '> quote'].join('\n')

describe('rendered blocks', () => {
  it('anchor each block to its starting source line', async () => {
    const blocks = await renderBlocks(md)
    expect(blocks.map((b) => [b.line, b.html.match(/^<(\w+)/)?.[1]])).toEqual([
      [0, 'h1'],
      [2, 'p'],
      [5, 'ul'],
      [8, 'pre'],
      [12, 'table'],
      [16, 'blockquote'],
    ])
  })

  it('shows raw HTML as text and drops unsafe links', async () => {
    const html = await renderHtml('<img src=x onerror=alert(1)> [bad](javascript:alert(1)) [ok](https://a.b)')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="https://a.b" target="_blank"')
  })

  it('resolves reference links defined elsewhere in the document', async () => {
    const blocks = await renderBlocks('See [the docs][d].\n\n[d]: https://example.com')
    expect(blocks[0].html).toContain('href="https://example.com"')
  })
})

describe('list items', () => {
  it('read in their own direction inside a list that takes one', async () => {
    const html = await renderHtml(['1. سند طراحی، ۱۴۰۵.', '2. Designing Data-Intensive Applications, O\'Reilly.', '3. Stream processing, chapter 11.'].join('\n'))
    expect(html).toContain('<li><div class="jot-li" dir="rtl">سند طراحی')
    expect(html).toContain('<li><div class="jot-li" dir="ltr">Designing')
    expect(html).toMatch(/^<ol>/) // the list itself: left-to-right, most of it English
  })
  it('leave nested lists outside the item\'s own text, and follow a forced direction', async () => {
    const md = ['- مورد فارسی', '  - English child'].join('\n')
    expect(await renderHtml(md)).toMatch(/<div class="jot-li" dir="rtl">مورد فارسی\s*<\/div><ul>/)
    expect(await renderHtml(md, { dir: 'ltr' })).not.toContain('jot-li')
    const withCode = ['1. نوشتن دوگانه را روشن کنید:', '   ```bash', '   ledger-sync config set dual_write=true --region eu-central-1', '   ```'].join('\n')
    expect(await renderHtml(withCode)).toContain('<div class="jot-li" dir="rtl">')
  })
})

describe('code colouring', () => {
  it('colours fenced code by its language, with the editor\'s groups', async () => {
    const html = await renderHtml('```js\n// hi\nconst x = "s" + 1\n```')
    expect(html).toContain('class="language-js"')
    expect(html).toContain('<span class="code-keyword">const</span>')
    expect(html).toContain('<span class="code-string">&quot;s&quot;</span>')
    expect(html).toContain('<span class="code-number">1</span>')
    expect(html).toContain('<span class="code-comment">// hi</span>')
  })

  it('leaves unknown or unnamed languages as plain escaped code', async () => {
    expect(await renderHtml('```nosuchlang\n<b>x</b>\n```')).toContain('<code class="language-nosuchlang">&lt;b&gt;x&lt;/b&gt;')
    expect(await renderHtml('```\nplain\n```')).toContain('<pre><code>plain')
  })
})

describe('fence names', () => {
  it('match by name, alias or file extension', async () => {
    const { findCodeLanguage } = await import('./code')
    expect(findCodeLanguage('python')?.name).toBe('Python')
    expect(findCodeLanguage('py')?.name).toBe('Python')
    expect(findCodeLanguage('rs')?.name).toBe('Rust')
    expect(findCodeLanguage('env')?.name).toBe('Properties files')
    expect(findCodeLanguage('.zshrc')?.name).toBe('Shell')
    expect(findCodeLanguage('nosuchlang')).toBeNull()
  })
})

describe('math', () => {
  it('renders $…$ inline and $$…$$ as a block', async () => {
    const html = await renderHtml('Energy $E = mc^2$ here.\n\n$$\n\\int_0^1 x\\,dx\n$$\n')
    expect(html).toContain('class="katex"')
    expect(html).toContain('<div class="jot-math-block"><span class="katex-display">')
  })

  it('leaves prices and lone dollars as text', async () => {
    const html = await renderHtml('It costs $5 and $10, or $ 3 each.')
    expect(html).not.toContain('katex')
    expect(html).toContain('$5 and $10')
  })

  it('shows bad TeX in place instead of failing the render', async () => {
    expect(await renderHtml('Broken $\\frac{1}{$ math.')).toContain('katex-error')
  })

  it('anchors a math block to its source line like any block', async () => {
    const blocks = await renderBlocks('Intro\n\n$$\nx^2\n$$\n\nAfter')
    expect(blocks.map((b) => b.line)).toEqual([0, 2, 6])
  })
})

describe('diagram frame', () => {
  it('names the diagram type from its first line', async () => {
    const { diagramType } = await import('./diagrams')
    expect(diagramType('flowchart LR\n  a --> b')).toBe('flowchart')
    expect(diagramType('%% comment\nsequenceDiagram\n  A->>B: hi')).toBe('sequenceDiagram')
    expect(diagramType('---\ntitle: x\n---\npie\n  "a": 1')).toBe('pie')
  })
})
