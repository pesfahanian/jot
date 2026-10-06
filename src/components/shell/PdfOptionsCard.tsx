import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { JotDocument } from '@/lib/db'
import { exportPdf } from '@/lib/export'
import { customSetsPage, PDF_DEFAULTS, SIZES, type PdfOptions } from '@/lib/pdfOptions'
import { getSettings, updateSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

// The PDF options card (design accepted 2026-10-05, frames 1–2): opens in
// place of the export menu on every PDF export, filled with the last
// choices; "continue to print" saves them and goes on to the browser's
// print dialog. Esc or a click outside cancels; Enter continues.

const choice =
  'flex h-[22px] items-center justify-center rounded-md border px-2 font-mono text-[11.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45'
// The chosen one takes the bubble's strong-neutral treatment.
const chosen = 'border-ink-tertiary bg-hover-lift text-foreground'
const unchosen = 'border-border bg-background text-secondary-foreground hover:text-foreground'

function Choices<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  render,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  disabled?: boolean
  render?: (v: T) => ReactNode
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button key={o} type="button" disabled={disabled} aria-pressed={o === value} onClick={() => onChange(o)} className={cn(choice, o === value ? chosen : unchosen)}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  )
}

function Row({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <div className="flex min-h-[26px] items-center gap-3">
      <span className="w-[92px] flex-none font-mono text-[11px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-auto items-center gap-2">
        {children}
        {note && <span className="font-mono text-[10.5px] text-muted-foreground">{note}</span>}
      </div>
    </div>
  )
}

// The paper, upright or on its side.
const Paper = ({ landscape }: { landscape?: boolean }) => (
  <span aria-hidden className={cn('block rounded-[1.5px] border-[1.5px] border-current', landscape ? 'h-[8px] w-[11px]' : 'h-[11px] w-[8px]')} />
)

export function PdfOptionsCard({ doc, text, onDone }: { doc: JotDocument; text: () => string; onDone: () => void }) {
  const stored = useLiveQuery(() => getSettings().then((s) => ({ ...PDF_DEFAULTS, ...s.pdf })), [])
  const [o, setO] = useState<PdfOptions | null>(null)
  const opts = o ?? stored ?? null
  const set = (patch: Partial<PdfOptions>) => setO((prev) => ({ ...(prev ?? stored ?? PDF_DEFAULTS), ...patch }))
  const self = useRef<HTMLDivElement>(null)

  const go = async () => {
    if (!opts) return
    await updateSettings({ pdf: opts })
    onDone()
    void exportPdf(doc.title, text(), opts, doc.dir ?? 'auto')
  }

  useEffect(() => {
    self.current?.querySelector<HTMLButtonElement>('[data-continue]')?.focus()
  }, [stored])

  if (!opts) return null
  const pageSet = customSetsPage(opts.customCss)
  const cssLines = opts.customCss.trim() ? opts.customCss.trim().split('\n').length : 0

  return (
    <div
      ref={self}
      onKeyDown={(e) => {
        // Enter continues — except in the CSS box, where it's a new line.
        if (e.key === 'Enter' && !(e.target as Element).closest('textarea')) {
          e.preventDefault()
          void go()
        }
      }}
      className="flex w-[320px] flex-col text-[13px]"
    >
      <div className="flex items-baseline gap-2 px-4 pt-3.5 pb-2.5">
        <span className="flex-auto text-[14.5px] font-semibold tracking-[-0.01em]">pdf options</span>
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground" title={doc.title}>
          {doc.title}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 px-4 pb-3">
        <Row label="page" note={pageSet ? 'set by your custom css' : undefined}>
          {!pageSet && (
            <>
              <Choices value={opts.page} options={['A4', 'Letter', 'A5'] as const} onChange={(page) => set({ page })} />
              <div className="flex gap-1">
                {(['portrait', 'landscape'] as const).map((orientation) => (
                  <button
                    key={orientation}
                    type="button"
                    aria-label={orientation}
                    title={orientation}
                    aria-pressed={opts.orientation === orientation}
                    onClick={() => set({ orientation })}
                    className={cn(choice, 'w-6 px-0', opts.orientation === orientation ? chosen : unchosen)}
                  >
                    <Paper landscape={orientation === 'landscape'} />
                  </button>
                ))}
              </div>
            </>
          )}
        </Row>
        <Row label="margins">
          <Choices value={opts.margins} options={['narrow', 'normal', 'wide'] as const} onChange={(margins) => set({ margins })} disabled={pageSet} />
        </Row>
        <Row label="font">
          <Choices
            value={opts.font}
            options={['sans', 'serif', 'mono'] as const}
            onChange={(font) => set({ font })}
            // Each choice set in its own face.
            render={(f) => <span style={{ fontFamily: f === 'sans' ? 'var(--font-sans)' : f === 'serif' ? '"Source Serif 4", serif' : 'var(--font-mono)' }}>{f}</span>}
          />
        </Row>
        <Row label="size" note="pt">
          <Choices value={opts.size} options={SIZES} onChange={(size) => set({ size })} />
        </Row>
        <Row label="colours">
          <Choices value={opts.preset} options={['jot', 'monochrome', 'classic'] as const} onChange={(preset) => set({ preset })} />
        </Row>
        <Row label="page numbers">
          <Choices value={opts.pageNumbers ? 'on' : 'off'} options={['on', 'off'] as const} onChange={(v) => set({ pageNumbers: v === 'on' })} />
        </Row>
      </div>
      <div className="border-t border-border px-4 py-2">
        <button type="button" aria-expanded={opts.advancedOpen} onClick={() => set({ advancedOpen: !opts.advancedOpen })} className="flex w-full items-center gap-2 font-mono text-[11.5px] text-secondary-foreground hover:text-foreground">
          <span className="w-2 text-[9px]">{opts.advancedOpen ? '▾' : '▸'}</span>
          <span className="flex-auto text-left">advanced</span>
          {/* Collapsed with CSS in the box: say so, so a remembered rule never
              restyles the next document unseen. */}
          {!opts.advancedOpen && cssLines > 0 && (
            <span className="flex items-center gap-1.5 text-foreground">
              <span className="size-[5px] rounded-full bg-ink-tertiary" />
              custom css · {cssLines} {cssLines === 1 ? 'line' : 'lines'}
            </span>
          )}
        </button>
        {opts.advancedOpen && (
          <div className="flex flex-col gap-2 pt-2 pb-1">
            <textarea
              value={opts.customCss}
              onChange={(e) => set({ customCss: e.target.value })}
              spellCheck={false}
              rows={5}
              aria-label="custom css"
              placeholder="h1 { letter-spacing: -0.01em; }"
              className="resize-none rounded-md border border-border bg-inset px-2.5 py-2 font-mono text-[11.5px] leading-[1.6] text-foreground outline-none placeholder:text-ink-dim focus:border-primary"
            />
            <div className="flex items-center gap-2">
              <span className="flex-auto text-[12px] leading-[1.45] text-muted-foreground">Applied last, so it overrides everything above.</span>
              <button type="button" onClick={() => set({ customCss: '' })} className={cn(choice, unchosen)}>
                clear
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-1.5 border-t border-border px-4 py-3">
        <button type="button" onClick={onDone} className={cn(choice, unchosen, 'h-6 px-[11px]')}>
          cancel
        </button>
        <button
          type="button"
          data-continue=""
          onClick={() => void go()}
          className="flex h-6 items-center rounded-md bg-primary px-[11px] font-mono text-[11.5px] font-semibold text-primary-foreground hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          continue to print
        </button>
      </div>
    </div>
  )
}
