// PDF options (design accepted 2026-10-05; frames in docs/design/pdf-options/):
// a small card on every PDF export, filled with the last choices — one
// remembered set for every document. Everything here becomes the print
// stylesheet; the custom CSS goes on last, so it wins.
//
// Presets change colour, rules and block styling — never the font. Farsi
// text always sets in Vazirmatn whatever the font, is never justified, and
// never takes the classic preset's italics (Farsi design).

export type PageSize = 'A4' | 'Letter' | 'A5'
export type Orientation = 'portrait' | 'landscape'
export type Margins = 'narrow' | 'normal' | 'wide'
export type PdfFont = 'sans' | 'serif' | 'mono'
export type Preset = 'jot' | 'monochrome' | 'classic'

export interface PdfOptions {
  page: PageSize
  orientation: Orientation
  margins: Margins
  font: PdfFont
  size: number // body, in points
  preset: Preset
  pageNumbers: boolean
  customCss: string
  // The card's "advanced" section, remembered with the rest.
  advancedOpen: boolean
}

export const PDF_DEFAULTS: PdfOptions = {
  page: 'A4',
  orientation: 'portrait',
  margins: 'normal',
  font: 'sans',
  size: 11,
  preset: 'jot',
  pageNumbers: true,
  customCss: '',
  advancedOpen: false,
}

export const SIZES = [9, 10, 11, 12, 13] as const

// Equal on all four sides. A5 takes 70%, so wide doesn't leave a column a
// few words wide (designer's pushback, owner's call).
const MARGIN_MM: Record<Margins, number> = { narrow: 12.7, normal: 20, wide: 30 }
export function marginMm(margins: Margins, page: PageSize): number {
  const mm = MARGIN_MM[margins] * (page === 'A5' ? 0.7 : 1)
  return Math.round(mm * 100) / 100
}

const PAGE_SIZE: Record<PageSize, string> = { A4: 'A4', Letter: 'letter', A5: 'A5' }

const FONT_STACK: Record<PdfFont, { stack: string; lineHeight: number }> = {
  sans: { stack: '"Public Sans", "Vazirmatn", Helvetica, sans-serif', lineHeight: 1.55 },
  serif: { stack: '"Source Serif 4", "Vazirmatn", Georgia, serif', lineHeight: 1.5 },
  mono: { stack: '"Source Code Pro", "Vazirmatn", ui-monospace, monospace', lineHeight: 1.6 },
}
const MONO = '"Source Code Pro", "Vazirmatn", ui-monospace, monospace'

// Custom CSS that sets the page itself (@page) overrides the card's page
// and margin choices, so the card greys those rows out rather than lie.
export const customSetsPage = (css: string) => /@page\b/i.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))

// The page number's grey, per preset.
const NUMBER_INK: Record<Preset, string> = { jot: '#868B91', monochrome: '#808080', classic: '#5F6469' }

const PRESETS: Record<Preset, string> = {
  // Today's look; every value a v3 token's light value.
  jot: `
    body { color: #25292F; }
    a { color: #0068B2; text-decoration: underline; text-decoration-thickness: 0.15mm; text-underline-offset: 2px; }
    blockquote { border-inline-start: 0.5mm solid #CCD0D3; padding-inline-start: 12px; color: #383E43; }
    table { border-top: 1px solid #B4B8BC; border-bottom: 1px solid #B4B8BC; }
    th { font-weight: 600; border-bottom: 1px solid #B4B8BC; }
    td { border-bottom: 1px solid #E6E8EA; }
    code { background: #F1F4F6; padding: 0 3px; border-radius: 3px; }
    pre { background: #F1F4F6; padding: 10px 12px; border-radius: 1.2mm; }
    pre code { background: none; padding: 0; }
    .code-keyword { color: #A83442; } .code-string { color: #0B7643; } .code-number { color: #7B6000; }
    .code-function { color: #0068B2; } .code-comment { color: #8A8F95; font-style: italic; }
    .jot-diagram { border: 1px solid #CCD0D3; border-radius: 8px; }
    del { color: #868B91; }
  `,
  // Zero-hue greys and print black, no fills anywhere, so nothing dithers
  // on a laser printer. Syntax survives as weight and italic.
  monochrome: `
    body { color: #000; }
    a { color: #000; text-decoration: underline; text-decoration-thickness: 0.15mm; text-underline-offset: 2px; }
    blockquote { border-inline-start: 0.5mm solid #808080; padding-inline-start: 12px; color: #555; }
    table { border-top: 1px solid #000; border-bottom: 1px solid #000; }
    th { font-weight: 600; border-bottom: 1px solid #000; }
    td { border-bottom: 1px solid #A4A4A4; }
    code { background: none; padding: 0; }
    pre { background: none; border: 0.25mm solid #A4A4A4; padding: 9px 11px; border-radius: 1.2mm; }
    .code-keyword { font-weight: 600; } .code-string { color: #555; } .code-comment { color: #808080; font-style: italic; }
    .jot-diagram { border: 0.25mm solid #A4A4A4; border-radius: 8px; }
    del { color: #808080; }
  `,
  // Book conventions: justified and hyphenated, following paragraphs
  // indented with no gap, light headings, three-rule tables, no fills or
  // colour. Justification and italics are for Latin text only.
  classic: `
    body { color: #25292F; }
    p { margin: 0; text-align: justify; hyphens: auto; }
    p + p { text-indent: 1.5em; }
    p + :not(p) { margin-top: 0.9em; }
    h1, h2, h3, h4, h5, h6 { font-weight: 400; }
    h2 { font-style: italic; }
    a { color: inherit; text-decoration: underline; text-decoration-color: #A7ABB0; text-underline-offset: 2px; }
    blockquote { font-style: italic; margin-inline: 2em; color: #25292F; }
    table { border-top: 0.4mm solid #25292F; border-bottom: 0.4mm solid #25292F; }
    th { font-weight: 400; font-style: italic; border-bottom: 0.2mm solid #25292F; }
    code { background: none; padding: 0; }
    pre { background: none; padding: 0 0 0 1.5em; }
    [class^="code-"] { color: inherit; } .code-comment { font-style: italic; }
    .jot-diagram { border: 0; }
    del { color: #5F6469; }
    /* Farsi: never justified or hyphenated, never italic. */
    [dir="rtl"], [dir="rtl"] p { text-align: start; hyphens: manual; }
    h2[dir="rtl"], blockquote[dir="rtl"], [dir="rtl"] th { font-style: normal; }
    /* A Farsi item's paragraphs keep the list's side, never justified. */
    .jot-li[dir="rtl"] p { text-align: inherit; }
  `,
}

// The whole print stylesheet for a set of choices. `rtl`: the document as a
// whole reads right-to-left, so page numbers take Persian digits.
export function pdfCss(o: PdfOptions, rtl = false): string {
  const font = FONT_STACK[o.font]
  const m = marginMm(o.margins, o.page)
  const pageNumber = o.pageNumbers
    ? `@bottom-center { content: counter(page${rtl ? ', persian' : ''}); font-family: ${MONO}; font-size: 8pt; color: ${NUMBER_INK[o.preset]}; }`
    : ''
  return `
  @page {
    size: ${PAGE_SIZE[o.page]} ${o.orientation};
    margin: ${m}mm;
    ${pageNumber}
  }
  html, body { background: #fff; }
  /* Fills and rules print even with the print dialog's "Background
     graphics" unticked (its default). */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${font.stack}; font-size: ${o.size}pt; line-height: ${font.lineHeight}; margin: 0; }
  /* Sizes scale with the body, as the rendered view's 22 / 19 / 16 over
     14.5. */
  h1, h2, h3, h4, h5, h6 { font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; margin: 1.3em 0 0.45em; break-after: avoid; }
  h1 { font-size: 1.52em; } h2 { font-size: 1.31em; } h3 { font-size: 1.1em; } h4, h5, h6 { font-size: 1em; }
  body > :first-child, .jot-keep:first-child > :first-child { margin-top: 0; }
  p { orphans: 3; widows: 3; }
  p, ul, ol, blockquote, pre, table { margin: 0 0 0.9em; }
  ul { list-style: disc; padding-inline-start: 1.4em; } ol { list-style: decimal; padding-inline-start: 1.6em; }
  li:has(> input[type="checkbox"], > .jot-li > input[type="checkbox"]) { list-style: none; margin-inline-start: -1.4em; }
  ol[dir="rtl"], [dir="rtl"] ol { list-style-type: persian; }
  .jot-li { text-align: left; } [dir="rtl"] li > .jot-li { text-align: right; }
  input[type="checkbox"] { margin: 0; margin-inline-end: 0.5em; }
  strong { font-weight: 600; }
  code, pre { font-family: ${MONO}; font-size: 0.86em; }
  pre { white-space: pre-wrap; direction: ltr; text-align: left; }
  /* Tables run a little smaller, and long cell text wraps, so wide tables
     fit the text width. */
  table { border-collapse: collapse; font-size: 0.9em; line-height: 1.4; max-width: 100%; }
  th, td { padding: 3px 6px; text-align: start; overflow-wrap: anywhere; }
  tr { break-inside: avoid; }
  hr { border: none; border-top: 1px solid #CCD0D3; margin: 1.6em 0; }
  img { max-width: 100%; }
  pre, blockquote, figure, img, .jot-math-block, .jot-keep { break-inside: avoid; }
  .jot-diagram { margin: 0 0 0.9em; }
  .jot-diagram-body { padding: 14px; text-align: center; }
  .jot-diagram-body svg { max-width: 100%; max-height: 110mm; height: auto; }
  .jot-diagram figcaption { border-top: 1px solid #E6E8EA; padding: 5px 12px; font-family: ${MONO}; font-size: 7.5pt; color: #868B91; }
  .jot-diagram-error { padding: 8px 12px 0; font-family: ${MONO}; font-size: 8pt; color: #B32035; }
  .jot-math-block { margin: 0 0 0.9em; }
  /* Farsi and mixed documents, as in the rendered view. */
  :not(pre) > code, .katex, a[dir="ltr"] { direction: ltr; unicode-bidi: isolate; }
  [dir="rtl"] { line-height: 1.8; }
  /* A table only as wide as its content sits at the right edge when it
     reads right-to-left (the page itself stays left-to-right). */
  table[dir="rtl"] { margin-left: auto; margin-right: 0; }
  :is(h1, h2, h3, h4, h5, h6)[dir="rtl"] { letter-spacing: 0; line-height: 1.5; }
  em .jot-fa { font-style: normal; font-weight: 600; }
  strong .jot-fa { font-style: normal; font-weight: 800; }
  ${PRESETS[o.preset]}
  /* Custom CSS, applied last. */
  ${o.customCss}
`
}
