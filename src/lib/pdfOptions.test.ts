import { describe, expect, it } from 'vitest'
import { customSetsPage, marginMm, PDF_DEFAULTS, pdfCss } from './pdfOptions'

describe('pdf options → print CSS', () => {
  it('sets the page, margins and body from the choices', () => {
    const css = pdfCss({ ...PDF_DEFAULTS, page: 'Letter', orientation: 'landscape', margins: 'wide', font: 'serif', size: 12 })
    expect(css).toContain('size: letter landscape;')
    expect(css).toContain('margin: 30mm;')
    expect(css).toContain('font-size: 12pt; line-height: 1.5;')
    expect(css).toContain('"Source Serif 4", "Vazirmatn"')
  })
  it('scales margins on A5', () => {
    expect(marginMm('wide', 'A5')).toBe(21)
    expect(marginMm('normal', 'A4')).toBe(20)
    expect(marginMm('narrow', 'A5')).toBe(8.89)
  })
  it('numbers pages — in Persian digits for a right-to-left document — or not at all', () => {
    expect(pdfCss(PDF_DEFAULTS)).toContain('content: counter(page);')
    expect(pdfCss(PDF_DEFAULTS, true)).toContain('content: counter(page, persian);')
    expect(pdfCss({ ...PDF_DEFAULTS, pageNumbers: false })).not.toContain('@bottom-center')
  })
  it('puts custom CSS last, after the preset', () => {
    const css = pdfCss({ ...PDF_DEFAULTS, preset: 'classic', customCss: 'h1 { color: red; }' })
    expect(css.lastIndexOf('h1 { color: red; }')).toBeGreaterThan(css.indexOf('text-align: justify'))
  })
  it('never justifies or italicises Farsi in the classic preset', () => {
    const css = pdfCss({ ...PDF_DEFAULTS, preset: 'classic' })
    expect(css).toContain('[dir="rtl"], [dir="rtl"] p { text-align: start; hyphens: manual; }')
    expect(css).toContain('h2[dir="rtl"], blockquote[dir="rtl"], [dir="rtl"] th { font-style: normal; }')
  })
  it('notices custom CSS that sets the page itself, ignoring comments', () => {
    expect(customSetsPage('@page { size: A3 }')).toBe(true)
    expect(customSetsPage('/* no @page here */ h1 { color: red }')).toBe(false)
  })
})
