import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SplitIcon } from './icons'
import { cursorLine, firstLineNumber, lines, tabs, type Seg } from './sample'
import { TagMark } from './TagMark'

function TabBarControl({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-6 items-center gap-1.5 rounded-md border border-border-strong bg-control px-[9px] font-mono text-[11px] text-secondary-foreground"
    >
      {children}
    </button>
  )
}

function TabBar() {
  return (
    <div className="flex h-[38px] flex-none items-stretch border-b border-border bg-card">
      {tabs.map((tab, i) => {
        const active = i === 0
        return (
          <div
            key={tab.name}
            className={cn(
              'flex items-center gap-2.5 border-r border-border px-3.5',
              active
                ? '-mb-px border-b-2 border-b-primary bg-document text-foreground'
                : 'rounded-t-md text-secondary-foreground',
            )}
          >
            <TagMark slot={tab.tag} className="size-[7px]" />
            <span className={cn('text-[13px]', active && 'font-medium')}>{tab.name}</span>
            <span className={cn('font-mono text-[13px]', active ? 'text-muted-foreground' : 'text-ink-dim')}>×</span>
          </div>
        )
      })}
      <div className="flex-auto" />
      <div className="flex items-center gap-1.5 border-l border-border pr-2 pl-3">
        <TabBarControl>
          <SplitIcon />
          split
        </TabBarControl>
        <TabBarControl>render</TabBarControl>
        <TabBarControl>
          export <span className="text-muted-foreground">▾</span>
        </TabBarControl>
      </div>
    </div>
  )
}

const roleClass: Record<NonNullable<Seg['role']>, string> = {
  heading: 'text-syn-heading font-semibold',
  emph: 'text-syn-emph font-semibold',
  link: 'text-syn-link underline underline-offset-[3px]',
  code: 'text-syn-code',
  punct: 'text-syn-punct',
  quote: 'text-syn-quote',
  done: 'text-muted-foreground line-through',
  mark: 'bg-mark',
}

function Cursor() {
  return <span className="-mx-px inline-block h-[17px] w-[2px] bg-primary align-[-4px]" />
}

function Segment({ seg, withCursor }: { seg: Seg; withCursor: boolean }) {
  // The heading marker itself is regular weight in 8a/8b; only the text is 600.
  const cls = seg.role === 'heading' && seg.t === '### ' ? 'text-syn-heading' : seg.role && roleClass[seg.role]
  const inlineCode = seg.role === 'code' && !seg.t.startsWith('  ')
  return (
    <span className={cn(cls, inlineCode && 'bg-code-inline')}>
      {seg.t}
      {withCursor && <Cursor />}
    </span>
  )
}

export function EditorPanel() {
  const cursorIndex = cursorLine - firstLineNumber
  return (
    <section className="flex min-h-0 min-w-0 flex-auto flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-document">
      <TabBar />
      <div className="flex min-h-0 flex-auto overflow-hidden font-mono text-[13.5px] leading-(--leading-doc)">
        <div className="w-[46px] flex-none border-r border-rule-on-document pt-[18px] pr-2.5 text-right text-ink-dim select-none">
          {lines.map((_, i) => (
            <div key={i} className={cn(i === cursorIndex && 'font-medium text-foreground')}>
              {firstLineNumber + i}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-auto overflow-hidden pt-[18px] pl-[22px] whitespace-pre text-foreground">
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'min-h-[1lh]',
                line.block === 'code' && '-ml-6 border-l-2 border-border bg-inset pl-[22px]',
              )}
            >
              {line.segs.map((seg, j) => (
                <Segment key={j} seg={seg} withCursor={i === cursorIndex && seg.role === 'mark'} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
