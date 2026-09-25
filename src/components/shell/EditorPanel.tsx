import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SplitIcon } from './icons'
import { Editor } from '@/editor/Editor'
import type { JotDocument, TagColor } from '@/lib/db'
import { tabs } from './sample'
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

function TabBar({ activeTitle, activeColor }: { activeTitle: string; activeColor: TagColor | null }) {
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
            <TagMark slot={active ? (activeColor ?? undefined) : tab.tag} className="size-[7px]" />
            <span className={cn('text-[13px]', active && 'font-medium')}>{active ? activeTitle : tab.name}</span>
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

// The active tab is the real open document; the other tabs are still the
// 8a/8b placeholders until T3.2.
export function EditorPanel({
  doc,
  onContentChange,
}: {
  doc: JotDocument | null
  onContentChange: (content: string) => void
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-auto flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-document">
      <TabBar activeTitle={doc?.title ?? ''} activeColor={doc?.color ?? null} />
      {doc && <Editor key={doc.id} documentId={doc.id} initialContent={doc.content} onChange={onContentChange} />}
    </section>
  )
}
