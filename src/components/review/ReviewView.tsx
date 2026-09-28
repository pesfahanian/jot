import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { JotDocument, ReviewFlag, ReviewSession } from '@/lib/db'
import { cn } from '@/lib/utils'
import { applyPlan, canApply, counts, describe } from '@/review/model'
import { RULESET_NAME, RULESET_VERSION } from '@/review/ruleset'
import { useReview } from '@/state/review'
import { applyReview } from '@/state/reviewActions'
import { Bubble, KindMark, KindSample } from './Bubble'
import { KIND_ORDER, kindCounts, kindInfo, KINDS, ruleName } from '@/review/kinds'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { OriginalText, PreviewText } from './spans'

// The two-pane review (interaction spec §1–§8; frames 4a–4c, 6b, 6c).
// Original (locked, no handlers) | Result — preview (click a span to decide)
// | optional review log. Sits in the pane where the document is open.

const toolbarCell = 'flex items-center gap-[7px] border-border px-3 whitespace-nowrap'
const textPane =
  'min-h-0 flex-auto overflow-y-auto px-7 py-6 font-mono text-[13.5px] leading-[1.85] whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]'

function PaneHeader({ title, note, accent }: { title: string; note: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-[30px] flex-none items-center gap-[9px] border-t-2 border-b border-b-border bg-card px-3.5 font-mono text-[11.5px] text-secondary-foreground',
        accent ? 'border-t-primary' : 'border-t-border-strong',
      )}
    >
      <span className="font-medium text-foreground">{title}</span>
      <span className="text-muted-foreground">{note}</span>
    </div>
  )
}

// The legend (owner, testing): always visible under the toolbar, so the
// colors are learned while working. One entry per kind present — sample,
// name, how many are still undecided of how many — with the kind's one-line
// explanation on hover. "?" opens the fuller help.
function Legend({ flags }: { flags: ReviewFlag[] }) {
  const kinds = kindCounts(flags)
  return (
    <div className="flex h-[28px] flex-none items-center gap-4 overflow-hidden border-b border-border bg-card px-3.5 font-mono text-[11px] whitespace-nowrap">
      {kinds.map(({ kind, total, pending }) => (
        <span key={kind} title={KINDS[kind].help} className={cn('flex cursor-default items-center gap-1.5', pending === 0 && 'opacity-55')}>
          <KindSample kind={kind} />
          <span className="font-sans text-[12px] text-foreground">{KINDS[kind].name}</span>
          <span className="text-muted-foreground tabular-nums">{pending === total ? total : `${pending}/${total}`}</span>
        </span>
      ))}
      <span className="flex-auto" />
      <ReviewHelp />
    </div>
  )
}

function ReviewHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="how review works"
          title="how review works"
          className="flex size-[18px] flex-none items-center justify-center rounded-sm border border-border text-[11px] text-secondary-foreground hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[380px] flex-col gap-3 p-4 text-[12.5px] leading-relaxed">
        <div className="text-[14px] font-semibold">How review works</div>
        <div className="text-secondary-foreground">
          Click any marked text on the right to see the suggestion and decide. Nothing in your document changes until every flag is decided and you press{' '}
          <span className="font-mono text-foreground">apply</span>.
        </div>
        <div className="flex flex-col gap-2">
          {KIND_ORDER.map((kind) => (
            <div key={kind} className="flex gap-2.5">
              <span className="flex h-[20px] w-3 flex-none items-center justify-center">
                <KindSample kind={kind} />
              </span>
              <span>
                <span className="font-semibold">{KINDS[kind].name}</span> <span className="text-secondary-foreground">— {KINDS[kind].help}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="text-muted-foreground">Left: your original, with what would change struck through. Right: the result if you accept everything as suggested.</div>
      </PopoverContent>
    </Popover>
  )
}

// Review log (spec §8, §1.11): third pane, fixed 380, panel ground, document
// order. Decided rows recede; pending stay at full ink. Status is a word.
function ReviewLog({ flags, activeKey, onJump, onClose }: { flags: ReviewFlag[]; activeKey: string | null; onJump: (key: string) => void; onClose: () => void }) {
  const c = counts(flags)
  return (
    <aside className="flex w-[380px] flex-none flex-col border-l border-border bg-card">
      <div className="flex h-[30px] flex-none items-center gap-[9px] border-t-2 border-b border-t-border-strong border-b-border px-3.5 font-mono text-[11.5px]">
        <span className="font-medium text-foreground">review log</span>
        <span className="text-muted-foreground">document order</span>
        <span className="flex-auto" />
        <button type="button" aria-label="close review log" onClick={onClose} className="text-[13px] text-muted-foreground hover:text-foreground">
          ×
        </button>
      </div>
      <div className="min-h-0 flex-auto overflow-y-auto">
        {flags.map((f) => {
          const decided = f.status !== 'pending'
          return (
            <button
              key={f.key}
              type="button"
              data-log-key={f.key}
              title={f.id}
              onClick={() => onJump(f.key)}
              className={cn(
                'flex w-full gap-2.5 border-b border-l-2 border-b-border-subtle px-3.5 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                f.key === activeKey ? 'border-l-primary bg-popover' : 'border-l-transparent hover:bg-row-hover',
              )}
            >
              <KindMark f={f} className="mt-[4px]" />
              <span className="flex min-w-0 flex-auto flex-col gap-0.5 font-mono">
                <span className="flex items-baseline gap-2">
                  <span className={cn('flex-none font-sans text-[12px] font-semibold', decided ? 'text-ink-tertiary' : 'text-foreground')}>{kindInfo(f).name}</span>
                  {ruleName(f) && <span className="min-w-0 truncate text-[11px] text-muted-foreground">{ruleName(f)}</span>}
                  <span className="flex-auto" />
                  <span className={cn('text-[11px]', decided ? 'text-muted-foreground' : 'text-foreground')}>{f.status}</span>
                </span>
                <span className={cn('truncate text-[11.5px]', decided ? 'text-ink-tertiary' : 'text-secondary-foreground')}>{describe(f)}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-none items-center gap-4 border-t border-border-subtle px-3.5 py-2 font-mono text-[11px] text-muted-foreground">
        <span>
          decided <span className="text-foreground">{c.decided}</span>
        </span>
        <span>
          pending <span className="text-foreground">{c.pending}</span>
        </span>
      </div>
    </aside>
  )
}

export function ReviewView({ doc, session, paneId }: { doc: JotDocument; session: ReviewSession; paneId: string }) {
  const activeKey = useReview((s) => s.activeFlag)
  const setActive = useReview((s) => s.setActiveFlag)
  const decide = useReview((s) => s.decide)
  const logOpen = useReview((s) => s.logOpen)
  const toggleLog = useReview((s) => s.toggleLog)
  const closeReview = useReview((s) => s.closeReview)
  const left = useRef<HTMLDivElement>(null)
  const right = useRef<HTMLDivElement>(null)
  const [bubblePos, setBubblePos] = useState<CSSProperties | null>(null)

  const flags = session.flags
  const c = counts(flags)
  const ready = canApply(flags)
  const plan = ready ? applyPlan(session.source, flags) : null
  const active = flags.find((f) => f.key === activeKey) ?? null

  // Both panes scroll together (spec §1).
  useEffect(() => {
    const a = left.current
    const b = right.current
    if (!a || !b) return
    let lock: HTMLElement | null = null
    const sync = (from: HTMLElement, to: HTMLElement) => () => {
      if (lock && lock !== from) return
      lock = from
      const ratio = from.scrollTop / Math.max(1, from.scrollHeight - from.clientHeight)
      to.scrollTop = ratio * (to.scrollHeight - to.clientHeight)
      requestAnimationFrame(() => (lock = null))
    }
    const sa = sync(a, b)
    const sb = sync(b, a)
    a.addEventListener('scroll', sa)
    b.addEventListener('scroll', sb)
    return () => {
      a.removeEventListener('scroll', sa)
      b.removeEventListener('scroll', sb)
    }
  }, [])

  // The bubble floats over the right pane in its own layer, so it never
  // adds to the pane's scroll height (a taller right pane is what threw the
  // two panes' scroll sync out, and pushed a last-line bubble off the
  // bottom). It opens under its span, or above it when there's no room
  // below, and follows the span as the pane scrolls. A flag with nothing to
  // point at (a note, or a span superseded by a wider rewrite) opens at the
  // top of the pane.
  const overlay = useRef<HTMLDivElement>(null)
  const place = useCallback(() => {
    const pane = right.current
    const layer = overlay.current
    if (!pane || !layer || !activeKey) return setBubblePos(null)
    const el = pane.querySelector<HTMLElement>(`[data-flag-key="${activeKey}"]`)
    const next = (() => {
      if (!el) return { left: 28, top: 16 }
      const o = layer.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const h = layer.querySelector<HTMLElement>('[data-review-bubble]')?.offsetHeight ?? 180
      const left = Math.round(Math.max(12, Math.min(r.left - o.left, o.width - 432)))
      const below = r.bottom - o.top + 8
      const above = r.top - o.top - 8 - h
      return { left, top: Math.round(below + h > o.height - 8 && above >= 8 ? above : below) }
    })()
    setBubblePos((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next))
  }, [activeKey])
  // Measure after every render (the bubble's own height decides above or
  // below); the equality check stops it looping.
  useLayoutEffect(() => place())
  useEffect(() => {
    const pane = right.current
    pane?.addEventListener('scroll', place)
    window.addEventListener('resize', place)
    return () => {
      pane?.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
    }
  }, [place])
  // Opening a flag brings its span into view, so the bubble has room.
  useEffect(() => {
    if (activeKey) right.current?.querySelector<HTMLElement>(`[data-flag-key="${activeKey}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeKey])

  // Click-outside closes the bubble (spec §5).
  useEffect(() => {
    if (!active) return
    const down = (e: PointerEvent) => {
      const t = e.target as Element
      if (t.closest('[data-review-bubble]') || t.closest('[data-flag-key]') || t.closest('[data-log-key]')) return
      setActive(null)
    }
    window.addEventListener('pointerdown', down)
    return () => window.removeEventListener('pointerdown', down)
  }, [active, setActive])

  // A log entry scrolls both panes to its span and opens the bubble —
  // identical to a direct click (spec §8).
  const jump = (key: string) => {
    setActive(key)
    for (const pane of [left.current, right.current]) {
      pane?.querySelector<HTMLElement>(`[data-flag-key="${key}"]`)?.scrollIntoView({ block: 'center' })
    }
  }

  return (
    <div className="@container relative flex min-h-0 flex-auto flex-col" data-review-view="">
      <div className="flex h-[34px] flex-none items-stretch border-b border-border bg-background font-mono text-[11.5px]">
        {/* In a narrow (split) pane the path and ruleset cells give way; the
            counts, log toggle and apply always stay. */}
        <div className={cn(toolbarCell, 'min-w-0 border-r text-secondary-foreground @max-[860px]:hidden')}>
          <span className="truncate">{doc.title}.md</span>
        </div>
        <div className={cn(toolbarCell, 'border-r text-ink-tertiary @max-[1040px]:hidden')}>
          <span className="text-muted-foreground">ruleset</span>
          <span className="text-foreground">{RULESET_NAME}</span>
          <span className="text-muted-foreground">{RULESET_VERSION}</span>
        </div>
        <div className="flex-auto" />
        <div className={cn(toolbarCell, 'gap-3.5 border-l')}>
          {ready ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">decided</span>
                <span className="font-medium text-foreground">
                  {c.decided} / {c.proposed}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">changes</span>
                <span className="font-medium text-foreground">{plan?.changed}</span>
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">proposed</span>
                <span className="font-medium text-foreground">{c.proposed}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">decided</span>
                <span className="font-medium text-foreground">{c.decided}</span>
              </span>
            </>
          )}
          {/* Progress stays neutral until complete, then turns accent in the
              same frame as the button (6c). */}
          <span className="flex h-[3px] w-[68px] bg-border">
            <span className={ready ? 'bg-primary' : 'bg-ink-dim'} style={{ width: `${c.proposed ? (c.decided / c.proposed) * 100 : 100}%` }} />
          </span>
        </div>
        <div className="flex items-center gap-1.5 pr-2.5 pl-1 whitespace-nowrap">
          <button
            type="button"
            onClick={toggleLog}
            aria-pressed={logOpen}
            // Which model answered (Google fails over down a chain).
            title={`reviewed by ${session.model}`}
            className={cn(
              'flex h-[22px] items-center rounded-md border px-[7px] text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              logOpen ? 'border-border-strong bg-popover text-foreground' : 'border-border bg-control text-secondary-foreground hover:text-foreground',
            )}
          >
            review log
          </button>
          {/* Apply only takes the accent at N/N decided (§1.4). Until then
              it's dashed and dim, and says how far along it is. */}
          <button
            type="button"
            disabled={!ready}
            title={ready ? 'write the decided changes into the document' : 'disabled until every flag is decided'}
            onClick={() => void applyReview(doc.id, paneId)}
            className={cn(
              'flex h-[22px] items-center rounded-md border px-[9px] text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              ready ? 'border-primary bg-primary font-semibold text-primary-foreground hover:brightness-110' : 'border-dashed border-border text-ink-dim',
            )}
          >
            {ready ? `apply ${c.proposed} ${c.proposed === 1 ? 'decision' : 'decisions'}` : `apply ${c.decided} of ${c.proposed}`}
          </button>
          <button
            type="button"
            onClick={() => closeReview(paneId)}
            title="close the review — undecided flags are kept for later"
            className="flex h-[22px] items-center rounded-md px-1.5 text-[13px] text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
      </div>

      <Legend flags={flags} />
      <div className="flex min-h-0 flex-auto">
        <section className="flex min-w-0 flex-1 flex-col bg-document" data-review-original="">
          <PaneHeader title="original" note="locked while review is open" />
          <div ref={left} className={textPane}>
            <OriginalText source={session.source} flags={flags} activeKey={activeKey} />
          </div>
        </section>
        <div className="w-px flex-none bg-border" />
        <section className="flex min-w-0 flex-1 flex-col bg-document" data-review-preview="">
          <PaneHeader title="result — preview" note={c.decided ? `${c.decided} of ${c.proposed} decided` : 'click a span to decide'} accent />
          <div className="relative flex min-h-0 flex-auto flex-col">
            <div ref={right} className={textPane}>
              <PreviewText source={session.source} flags={flags} activeKey={activeKey} onOpen={setActive} />
              {c.proposed === 0 && (
                <div className="mt-6 font-sans text-[13px] whitespace-normal text-muted-foreground">Nothing to flag — this document passes every rule.</div>
              )}
            </div>
            {/* The bubble's layer: over the text, never part of its scroll. */}
            <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden">
              {active && (
                <Bubble
                  key={active.key}
                  flag={active}
                  style={{ ...(bubblePos ?? { left: 0, top: 0, visibility: 'hidden' }), pointerEvents: 'auto' }}
                  onClose={() => setActive(null)}
                  onDecide={(d, text) => decide(doc.id, active.key, d, text)}
                />
              )}
            </div>
          </div>
        </section>
        {logOpen && <ReviewLog flags={flags} activeKey={activeKey} onJump={jump} onClose={toggleLog} />}
      </div>
    </div>
  )
}
