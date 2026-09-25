import { useLiveQuery } from 'dexie-react-hooks'
import { openContent } from '@/editor/sessions'
import { db, type JotDocument } from '@/lib/db'
import { countText, groupDigits } from '@/lib/counts'
import { cn } from '@/lib/utils'
import { cycleTheme, type ThemePreference, type ThemeState } from '@/state/theme'
import { focusedPane, useWorkspace } from '@/state/workspace'

// Every cell reserves its width up front so the bar never reflows as values
// change (§1.9, T3.9): counts up to six digits, cursor up to 9999:999.
// Values sit in tabular figures inside that width.
function Cell({ label, value, width, className }: { label: string; value: string; width: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 border-l border-border-subtle px-[11px]', className)}>
      <span className="font-normal text-muted-foreground">{label}</span>
      <span className="tabular-nums" style={{ minWidth: width }}>
        {value}
      </span>
    </div>
  )
}

// Review control (2f): one fixed slot, left of everything else. Idle when a
// non-empty document is open; the disabled register otherwise. Running,
// error and the no-key mapping arrive with Phase 5.
function ReviewControl({ enabled }: { enabled: boolean }) {
  return (
    <div className="flex w-[124px] flex-none items-center border-r border-border-subtle px-[5px] whitespace-nowrap">
      <button
        type="button"
        disabled={!enabled}
        title={enabled ? 'review style' : 'nothing to review'}
        className={cn(
          'flex h-[18px] items-center gap-1.5 rounded-sm border px-[7px]',
          enabled ? 'border-border-strong hover:bg-hover-lift' : 'border-border text-ink-dim',
        )}
      >
        <span className={cn('size-[5px] rounded-[2px]', enabled ? 'bg-primary' : 'bg-ink-mute')} />
        review style
      </button>
    </div>
  )
}

function KeyCell() {
  const hasKey = useLiveQuery(() => db.settings.get('settings').then((s) => !!s?.openRouterApiKey), []) ?? false
  return (
    <div className="flex items-center gap-1.5 border-r border-border-subtle px-[11px]">
      <span className="text-muted-foreground">key</span>
      <span className={cn('min-w-[4ch]', !hasKey && 'text-ink-dim')}>{hasKey ? 'set' : 'none'}</span>
    </div>
  )
}

// Theme switch (3f): text, not an icon, cycling light → dark → system; system
// appends what the OS resolves to, so the cell never lies.
function ThemeCell({ preference, resolved }: { preference: ThemePreference; resolved: 'light' | 'dark' }) {
  return (
    <button
      type="button"
      onClick={() => void cycleTheme(preference)}
      title="switch theme"
      className="flex items-center gap-1.5 border-l border-border-subtle pr-3 pl-[11px] hover:bg-hover-lift focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <span className="text-muted-foreground">theme</span>
      <span className="min-w-[14ch] text-left">
        {preference}
        {preference === 'system' && <span className="text-muted-foreground"> · {resolved}</span>}
      </span>
    </button>
  )
}

export function StatusBar({ docsById, theme }: { docsById: Map<string, JotDocument>; theme: ThemeState }) {
  const pane = useWorkspace(focusedPane)
  const cursor = useWorkspace((s) => s.cursor)
  const doc = pane?.active ? docsById.get(pane.active) : undefined
  const text = doc ? (openContent(doc.id) ?? doc.content) : ''
  const c = countText(text)
  const cur = cursor && doc && cursor.documentId === doc.id ? cursor : { line: 1, col: 1 }

  return (
    <footer className="flex h-7 flex-none items-stretch overflow-hidden rounded-(--radius-status) border border-border-strong bg-card font-mono text-[11.5px]">
      {/* With no document there is nothing to review or count (6d): only
          global state remains. */}
      {doc && (
        <>
          <ReviewControl enabled={text.trim().length > 0} />
          <KeyCell />
        </>
      )}
      <div className="flex-auto" />
      {doc && (
        <>
          <Cell label="bytes" value={groupDigits(c.bytes)} width="7ch" />
          <Cell label="chars" value={groupDigits(c.chars)} width="7ch" />
          <Cell label="words" value={groupDigits(c.words)} width="6ch" />
          <Cell label="lines" value={groupDigits(c.lines)} width="5ch" />
          <Cell label="paras" value={groupDigits(c.paras)} width="4ch" />
          <Cell label="cursor" value={`${cur.line}:${cur.col}`} width="9ch" className="font-medium" />
        </>
      )}
      <ThemeCell preference={theme.preference} resolved={theme.resolved} />
    </footer>
  )
}
