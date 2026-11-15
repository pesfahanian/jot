import { useLiveQuery } from 'dexie-react-hooks'
import { Check, PanelRight, PanelRightDashed } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { hasRtl, lineDirections, type DirSetting } from '@/lib/direction'
import { updateDocument } from '@/lib/documents'
import { openContent } from '@/editor/sessions'
import type { JotDocument } from '@/lib/db'
import { countText, groupDigits } from '@/lib/counts'
import { getSettings, updateSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { columnsOf, docIdOf } from '@/state/layout'
import { focusedPane, useWorkspace } from '@/state/workspace'
import { NotesCell } from '@/components/annotations/NotesCell'

// Counts hug their values and pack against the bar's right edge (§1.8:
// every number is monospace, tabular). The cursor, which changes width on
// almost every keystroke, leads the group and keeps its spare room on its
// left, in the bar's empty stretch — so its changes never move anything,
// and no gap shows. A count only nudges the cells left of it when it gains
// a digit.
function Cell({ label, value, reserve, className }: { label: string; value: string; reserve?: string; className?: string }) {
  return (
    // The leading (reserving) cell has no divider: it would stand in the
    // empty stretch, apart from the text.
    <div className={cn('flex items-center border-border-subtle px-2', !reserve && 'border-l', className)}>
      <span className="text-right tabular-nums" style={reserve ? { minWidth: `calc(${reserve} + ${label.length + 1}ch)` } : undefined}>
        <span className="font-normal text-muted-foreground">{label}</span> {value}
      </span>
    </div>
  )
}

// Text direction (Farsi support, design frame 6): a quiet cell before the
// cursor, shown only on a document with right-to-left text or a forced
// direction, so an English document's bar is unchanged. In auto it says
// what the block under the cursor resolved to. A menu, not a cycle: a
// change reflows the whole document, so the choice is explicit. Stored with
// the document.
const DIR_CHOICES: { value: DirSetting; label: string; hint: string }[] = [
  { value: 'auto', label: 'auto', hint: 'by block' },
  { value: 'rtl', label: 'right-to-left', hint: 'rtl' },
  { value: 'ltr', label: 'left-to-right', hint: 'ltr' },
]

function DirCell({ doc, text, line }: { doc: JotDocument; text: string; line: number }) {
  const setting: DirSetting = doc.dir ?? 'auto'
  if (setting === 'auto' && !hasRtl(text)) return null
  const resolved = lineDirections(text, setting)[line - 1] ?? 'ltr'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" title="text direction of this document" className="flex items-center px-2 hover:bg-hover-lift data-[state=open]:bg-hover-lift">
          <span className="text-muted-foreground">dir</span>&nbsp;{setting}
          {setting === 'auto' && <span className="text-muted-foreground">&nbsp;·&nbsp;{resolved}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-[220px]">
        <div className="px-2.5 pt-1 pb-0.5 font-mono text-[11px] text-muted-foreground">direction · this document</div>
        {DIR_CHOICES.map((c) => (
          <DropdownMenuItem key={c.value} onSelect={() => void updateDocument(doc.id, { dir: c.value })} className={cn(c.value === setting && 'text-foreground')}>
            <Check size={13} strokeWidth={2} className={cn('text-primary', c.value !== setting && 'invisible')} aria-hidden />
            <span className="flex-auto">{c.label}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{c.hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Minimap on/off (Phase 8; in the status bar since the owner moved it), one
// setting for every editor. Lit while on. With three columns open the
// editors hide it regardless — the tooltip says so.
function MinimapToggle() {
  const on = useLiveQuery(() => getSettings().then((s) => s.minimap ?? true), []) ?? true
  const crowded = useWorkspace((s) => columnsOf(s.panes).length >= 3)
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="minimap"
      title={`minimap: ${on ? 'on' : 'off'}${on && crowded ? ' (hidden with three columns)' : ''} — click to ${on ? 'hide' : 'show'}`}
      onClick={() => void updateSettings({ minimap: !on })}
      className={cn(
        'flex w-[30px] flex-none items-center justify-center border-l border-border-subtle hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        on ? 'text-secondary-foreground' : 'text-ink-dim',
      )}
    >
      {on ? <PanelRight size={13} strokeWidth={1.75} aria-hidden /> : <PanelRightDashed size={13} strokeWidth={1.75} aria-hidden />}
    </button>
  )
}

export function StatusBar({ docsById }: { docsById: Map<string, JotDocument> }) {
  const pane = useWorkspace(focusedPane)
  const cursor = useWorkspace((s) => s.cursor)
  // A rendered tab counts as its document.
  const doc = pane?.active ? docsById.get(docIdOf(pane.active)) : undefined
  const text = doc ? (openContent(doc.id) ?? doc.content) : ''
  const c = countText(text)
  const cur = cursor && doc && cursor.documentId === doc.id ? cursor : { line: 1, col: 1 }

  return (
    <footer className="flex h-7 flex-none items-stretch overflow-hidden rounded-(--radius-status) border border-border-strong bg-card font-mono text-[11.5px]">
      {/* The bar is about the focused document; the one global control
          here is the minimap toggle (owner). */}
      <div className="flex-auto" />
      {doc && (
        <>
          <DirCell doc={doc} text={text} line={cur.line} />
          <Cell label="cursor" value={`${cur.line}:${cur.col}`} reserve="7ch" className="font-medium" />
          <Cell label="bytes" value={groupDigits(c.bytes)} />
          <Cell label="chars" value={groupDigits(c.chars)} />
          <Cell label="words" value={groupDigits(c.words)} />
          <Cell label="lines" value={groupDigits(c.lines)} />
          <Cell label="paras" value={groupDigits(c.paras)} className="pr-2.5" />
          <NotesCell documentId={doc.id} />
        </>
      )}
      {/* The minimap toggle, at the far right (round 4). */}
      <MinimapToggle />
    </footer>
  )
}
