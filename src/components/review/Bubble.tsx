import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ReviewFlag } from '@/lib/db'
import { cn } from '@/lib/utils'
import { allowedDecisions, isNote, isProofing, type Decision } from '@/review/model'
import { KeycapPanel } from './Keycap'
import { kindInfo, kindOf, KINDS, ruleName, type Kind } from '@/review/kinds'

// Bubbles (interaction spec §2, §5; design system §1.11): radius 12, float
// border, keycap elevation on the panel ground. Actions 24px; accept is
// strong-neutral, the rest default. No shortcut keycaps — the review
// keyboard model is deferred (spec §6).

const action = 'flex h-6 items-center rounded-md border px-2.5 font-mono text-[11.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
const strongAction = cn(action, 'border-ink-tertiary bg-background text-foreground hover:border-foreground')
const defaultAction = cn(action, 'border-border bg-background text-secondary-foreground hover:text-foreground')

const statusWord: Record<ReviewFlag['status'], string> = {
  pending: 'pending',
  accepted: 'accepted',
  rejected: 'rejected',
  ignored: 'ignored',
  dismissed: 'dismissed',
  edited: 'edited',
}

// The kind's sample, as the legend draws it.
export function KindMark({ f, className }: { f: ReviewFlag; className?: string }) {
  return <KindSample kind={kindOf(f)} className={className} />
}

export function KindSample({ kind, className }: { kind: Kind; className?: string }) {
  const k = KINDS[kind]
  if (k.mark === 'squiggle')
    return (
      <svg width="12" height="6" viewBox="0 0 12 6" className={cn('flex-none', className)} aria-hidden>
        <path d="M0 4 Q1.5 1 3 4 T6 4 T9 4 T12 4" fill="none" stroke={k.ink} strokeWidth="1.5" />
      </svg>
    )
  if (k.mark === 'none') return <span className={cn('size-2.5 flex-none rounded-sm border border-dashed border-ink-dim', className)} />
  return <span className={cn('size-2.5 flex-none rounded-sm border', className)} style={{ background: k.ground, borderColor: k.ink }} />
}

export function Bubble({
  flag,
  onDecide,
  onClose,
  style,
}: {
  flag: ReviewFlag
  onDecide: (d: Decision, text?: string) => void
  onClose: () => void
  style?: React.CSSProperties
}) {
  const allowed = allowedDecisions(flag)
  const tier2 = !isNote(flag) && (flag.family === 'tier2' || flag.kind === 'flag')
  const [writing, setWriting] = useState(tier2)
  const [draft, setDraft] = useState(flag.userText ?? (tier2 ? '' : (flag.after ?? flag.before)))
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (writing && !tier2) field.current?.focus()
  }, [writing, tier2])

  const decided = flag.status !== 'pending'
  let body: ReactNode = null
  let actions: ReactNode = null

  if (isNote(flag)) {
    // A model quote that didn't match the document: comment-only.
    body = (
      <div className="flex flex-col gap-2 border-b border-border px-3 py-[11px]">
        <div className="border-l-2 border-ink-dim pl-2.5 font-mono text-[12.5px] leading-relaxed text-muted-foreground">{flag.before}</div>
        <div className="text-[12.5px] leading-relaxed text-foreground">{flag.rationale}</div>
        <div className="font-mono text-[11px] text-muted-foreground">quoted text not found in the document — shown as a note</div>
      </div>
    )
    actions = (
      <button type="button" className={strongAction} onClick={() => onDecide('dismiss')}>
        dismiss
      </button>
    )
  } else if (isProofing(flag.family)) {
    // Proofing: the plain suggested fix, no before/after, no rationale;
    // Accept / Ignore — the vocabulary every spellchecker already uses.
    body = <div className="border-b border-border px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-foreground">{flag.after}</div>
    actions = (
      <>
        <button type="button" className={strongAction} onClick={() => onDecide('accept')}>
          accept
        </button>
        <button type="button" className={defaultAction} onClick={() => onDecide('ignore')}>
          ignore
        </button>
      </>
    )
  } else if (tier2) {
    // Tier 2: the flagged span quoted, the rationale as primary content, and
    // the writing field is the work.
    body = (
      <div className="flex flex-col gap-2 border-b border-border px-3 py-[11px]">
        <div className="border-l-2 pl-2.5 font-mono text-[12.5px] leading-relaxed text-foreground" style={{ borderColor: kindInfo(flag).ink }}>
          {flag.before}
        </div>
        <div className="text-[12.5px] leading-relaxed text-foreground">{flag.rationale}</div>
      </div>
    )
  } else {
    // Tier 1: rationale shown directly, no before/after (the change is
    // already visible across the panes). Tier 1b: before/after quoted,
    // rationale behind the "?".
    body =
      flag.family === 'tier1b' ? (
        <div className="flex flex-col gap-px border-b border-border px-3 py-2.5 font-mono text-[12.5px] leading-relaxed">
          <div className="flex gap-2.5">
            <span className="w-11 flex-none text-[11px] text-muted-foreground">before</span>
            <span className="text-muted-foreground line-through">{flag.before}</span>
          </div>
          <div className="flex gap-2.5">
            <span className="w-11 flex-none text-[11px] text-muted-foreground">after</span>
            <span className="text-foreground">{flag.after === '' ? '(deleted)' : flag.after}</span>
          </div>
        </div>
      ) : (
        <div className="border-b border-border px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground">{flag.rationale}</div>
      )
    actions = (
      <>
        <button type="button" className={strongAction} onClick={() => onDecide('accept')}>
          accept
        </button>
        <button type="button" className={defaultAction} onClick={() => onDecide('reject')}>
          reject
        </button>
        {allowed.includes('edit') && !writing && (
          <button type="button" className={defaultAction} onClick={() => setWriting(true)}>
            write my own
          </button>
        )}
      </>
    )
  }

  if (writing && !isNote(flag) && !isProofing(flag.family)) {
    const save = () => draft.trim() && onDecide('edit', draft)
    body = (
      <>
        {body}
        <div className="px-3 pt-2.5 pb-1">
          <textarea
            ref={field}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
            }}
            rows={2}
            spellCheck
            placeholder={tier2 ? 'your wording' : ''}
            className="min-h-[52px] w-full resize-y rounded-md border border-border bg-document px-2.5 py-2 font-mono text-[12.5px] leading-relaxed text-foreground outline-none focus:border-primary"
          />
        </div>
      </>
    )
    actions = (
      <>
        <button type="button" className={strongAction} disabled={!draft.trim()} onClick={save}>
          save edit
        </button>
        {tier2 ? (
          <>
            <button type="button" className={defaultAction} onClick={() => onDecide('dismiss')}>
              dismiss flag
            </button>
            <span className="flex-auto" />
            <span className="font-mono text-[11px] text-muted-foreground">either counts as decided</span>
          </>
        ) : (
          <button type="button" className={defaultAction} onClick={() => setWriting(false)}>
            cancel
          </button>
        )}
      </>
    )
  }

  return (
    <KeycapPanel
      data-review-bubble=""
      style={style}
      className="absolute z-30 w-[420px] max-w-[calc(100%-24px)] overflow-hidden text-foreground"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-[9px] border-b border-border py-2 pr-2.5 pl-3">
        <KindMark f={flag} />
        <span className="flex-none text-[12.5px] font-semibold" style={{ color: kindInfo(flag).ink }} title={kindInfo(flag).help}>
          {kindInfo(flag).name}
        </span>
        {ruleName(flag) && <span className="min-w-0 truncate font-mono text-[11px] text-ink-tertiary">{ruleName(flag)}</span>}
        {flag.family === 'tier1b' && !tier2 && (
          // Hover tooltip inside an already-open bubble — the one allowed
          // hover surface (spec §5).
          <span title={flag.rationale} className="flex size-[15px] cursor-help items-center justify-center rounded-sm border border-border font-mono text-[10.5px] text-ink-tertiary">
            ?
          </span>
        )}
        <span className="flex-auto" />
        {decided && <span className="font-mono text-[11px] text-muted-foreground">{statusWord[flag.status]}</span>}
        <button type="button" aria-label="close" onClick={onClose} className="font-mono text-[13px] text-muted-foreground hover:text-foreground">
          ×
        </button>
      </div>
      {body}
      <div className="flex items-center gap-1.5 px-3 py-[9px]">{actions}</div>
    </KeycapPanel>
  )
}
