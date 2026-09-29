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
