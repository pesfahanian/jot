import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Settings' small parts (round 4): switch, segmented control, key chip, and
// the section heading and label grid every section shares.

// 22 × 12, ink when on, the mute mark when off.
export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'flex h-3 w-[22px] flex-none rounded-full p-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50',
        on ? 'justify-end bg-secondary-foreground' : 'justify-start bg-ink-mute',
      )}
    >
      <span className="size-2.5 rounded-full bg-document" />
    </button>
  )
}

// The chosen option in strong neutral (as the PDF card's choices).
export function Segmented<T extends string>({ value, options, onChange, render }: { value: T; options: readonly T[]; onChange: (v: T) => void; render?: (v: T) => ReactNode }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={cn(
            'flex h-[22px] items-center rounded-md border px-2 font-mono text-[11.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            o === value ? 'border-ink-tertiary bg-hover-lift text-foreground' : 'border-border bg-background text-secondary-foreground hover:text-foreground',
          )}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  )
}

export function KeyChip({ children, active, className }: { children: ReactNode; active?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-sm border px-1.5 py-0.5 font-mono text-[11px]',
        active ? 'border-primary bg-document font-medium text-foreground' : 'border-border bg-background',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SectionHead({ title, children, id }: { title: string; children?: ReactNode; id?: string }) {
  return (
    <div id={id} className="flex flex-col gap-1">
      <span className="text-[15px] font-semibold tracking-[-0.02em]">{title}</span>
      {children && <span className="text-[12.5px] leading-normal text-pretty text-ink-tertiary">{children}</span>}
    </div>
  )
}

// Labels in a mono column, controls beside them.
export function Grid({ children, label = 92 }: { children: ReactNode; label?: number }) {
  return (
    <div className="grid items-center gap-x-3 gap-y-2.5 font-mono text-[11px]" style={{ gridTemplateColumns: `${label}px minmax(0, 1fr)` }}>
      {children}
    </div>
  )
}

export const Label = ({ children, top }: { children: ReactNode; top?: boolean }) => <span className={cn('text-ink-tertiary', top && 'self-start pt-[7px]')}>{children}</span>

export const Rule = () => <div className="h-px bg-border-subtle" />

export const quietButton =
  'flex h-[26px] items-center rounded-md border border-border bg-background px-[9px] font-mono text-[11px] text-secondary-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:text-ink-dim'
