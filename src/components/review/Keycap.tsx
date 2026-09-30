import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// The one elevation exception in the design system (§1.9, §1.10), reserved
// for the AI review panel and the shortcut keys inside it. Everything else in
// Jot is flat: a border weight plus a luminance step.
//
// The ground is part of the token, not a choice: on light the bevel only
// reads on panel (#E4E6E9) — on the near-white surface there is no room
// above a near-white key for its highlight. So the ground is set inline,
// where a className can't override it.
const panelGround: CSSProperties = { backgroundColor: 'var(--card)', boxShadow: 'var(--keycap)' }

export function KeycapPanel({ className, style, children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      {...rest}
      data-keycap-panel=""
      style={{ ...style, ...panelGround }}
      className={cn('rounded-(--radius-panel) border border-border-float', className)}
    >
      {children}
    </div>
  )
}

// A shortcut key (3g). Keys sit inside a KeycapPanel only. The guide card
// (sidebar foot "?", Phase 10) is their first use; the review keyboard
// model is still deferred (interaction spec §6).
export function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd
      style={{ boxShadow: 'var(--keycap-key)' }}
      className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-sm border border-border-strong bg-background px-1 font-mono text-[11px] text-ink-tertiary"
    >
      {children}
    </kbd>
  )
}
