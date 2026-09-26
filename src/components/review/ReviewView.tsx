import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { JotDocument, ReviewFlag, ReviewSession } from '@/lib/db'
import { cn } from '@/lib/utils'
import { applyPlan, canApply, counts, describe, isNote, isProofing } from '@/review/model'
import { RULESET_NAME, RULESET_VERSION } from '@/review/ruleset'
import { useReview } from '@/state/review'
import { applyReview } from '@/state/reviewActions'
import { Bubble } from './Bubble'
import { proofInk, tierGround, tierInk } from '@/review/decor'
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

const typeLabel = (f: ReviewFlag) => (isNote(f) ? 'note' : f.family === 'tier1' ? 'tier 1' : f.family === 'tier1b' ? 'tier 1b' : f.family === 'tier2' ? 'tier 2' : f.family)

function LogMark({ f }: { f: ReviewFlag }) {
  if (isProofing(f.family)) return <span className="mt-[7px] h-0 w-[9px] flex-none border-b-[1.5px]" style={{ borderColor: proofInk[f.family] }} />
  return <span className="mt-[3px] size-[9px] flex-none rounded-[2px] border" style={{ background: tierGround[f.family] ?? 'var(--resolved-bg)', borderColor: tierInk[f.family] ?? 'var(--ink-dim)' }} />
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
              onClick={() => onJump(f.key)}
              className={cn(
                'flex w-full gap-2.5 border-b border-l-2 border-b-border-subtle px-3.5 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                f.key === activeKey ? 'border-l-primary bg-popover' : 'border-l-transparent hover:bg-row-hover',
              )}
            >
              <LogMark f={f} />
              <span className="flex min-w-0 flex-auto flex-col gap-0.5 font-mono">
                <span className="flex items-baseline gap-2">
                  <span className={cn('text-[12px] font-semibold', decided ? 'text-ink-tertiary' : 'text-foreground')}>{f.id}</span>
                  <span className="text-[11px] text-muted-foreground">{typeLabel(f)}</span>
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

  // The bubble opens under its span on the right; a flag with nothing to
  // point at there (a note, or a span superseded by a wider rewrite) opens
  // at the top of the pane.
  useLayoutEffect(() => {
    const pane = right.current
    if (!pane || !active) return setBubblePos(null)
    const el = pane.querySelector<HTMLElement>(`[data-flag-key="${active.key}"]`)
    if (!el) return setBubblePos({ left: 28, top: pane.scrollTop + 16 })
    const p = pane.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const leftPx = Math.max(12, Math.min(r.left - p.left, p.width - 432))
    setBubblePos({ left: leftPx, top: r.bottom - p.top + pane.scrollTop + 8 })
  }, [active, flags, logOpen])

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
          <div ref={right} className={cn(textPane, 'relative')}>
            <PreviewText source={session.source} flags={flags} activeKey={activeKey} onOpen={setActive} />
            {c.proposed === 0 && (
              <div className="mt-6 font-sans text-[13px] whitespace-normal text-muted-foreground">Nothing to flag — this document passes every rule.</div>
            )}
            {active && bubblePos && (
              <Bubble key={active.key} flag={active} style={bubblePos} onClose={() => setActive(null)} onDecide={(d, text) => decide(doc.id, active.key, d, text)} />
            )}
          </div>
        </section>
        {logOpen && <ReviewLog flags={flags} activeKey={activeKey} onJump={jump} onClose={toggleLog} />}
      </div>
    </div>
  )
}
