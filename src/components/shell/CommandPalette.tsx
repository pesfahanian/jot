import { useLiveQuery } from 'dexie-react-hooks'
import { Dialog as D } from 'radix-ui'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { JotDocument } from '@/lib/db'
import { relativeTime, searchDocuments } from '@/lib/docList'
import { matchRange, matchScore, snippet } from '@/lib/palette'
import { formatKey } from '@/lib/shortcuts'
import { getSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { COMMANDS, commandById, commandContext, keysOf, recentCommands, runCommand, type Command } from '@/state/commands'
import { useDocuments, useNow } from '@/state/hooks'
import { useUi } from '@/state/ui'
import { useWorkspace } from '@/state/workspace'
import { TagMark } from './TagMark'

// The command palette (round 4, frame 4): ⌘K. 560 wide, 80px below the top
// of the tray, centred. Documents and commands in one list with no prefix;
// empty, it offers recent and suggested; ↵ runs a command or opens a
// document here, ⌘↵ opens it beside.

type Row = { kind: 'command'; command: Command } | { kind: 'doc'; doc: JotDocument; hit?: { text: string; range: [number, number] } }
type Section = { label?: string; rows: Row[] }
const NO_DOCS: JotDocument[] = []

function Marked({ text, range }: { text: string; range: [number, number] | null }) {
  if (!range) return <>{text}</>
  return (
    <>
      {text.slice(0, range[0])}
      <strong className="font-semibold">{text.slice(range[0], range[1])}</strong>
      {text.slice(range[1])}
    </>
  )
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  const setOpen = useUi((s) => s.setPalette)
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Content
          aria-describedby={undefined}
          className="jot-palette fixed top-[88px] left-1/2 z-50 flex w-[560px] -translate-x-1/2 flex-col overflow-hidden rounded-(--radius-panel) border border-border-float bg-popover text-foreground outline-none"
        >
          <D.Title className="sr-only">command palette</D.Title>
          {open && <PaletteBody onClose={() => setOpen(false)} />}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const docs = useDocuments() ?? NO_DOCS
  const settings = useLiveQuery(() => getSettings(), [])
  const now = useNow()
  const openDocument = useWorkspace((s) => s.openDocument)
  const openBeside = useWorkspace((s) => s.openBeside)
  const list = useRef<HTMLDivElement>(null)
  const ctx = commandContext(settings)
  const usable = COMMANDS.filter((c) => c.id !== 'palette' && (!c.enabled || c.enabled(ctx)))

  const sections: Section[] = useMemo(() => {
    const q = query.trim()
    if (!q) {
      const recentIds = recentCommands().filter((id) => usable.some((c) => c.id === id))
      const recent: Row[] = recentIds.slice(0, 3).map((id) => ({ kind: 'command', command: commandById.get(id)! }))
      const lastDocs = [...docs].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 2)
      const suggested: Row[] = usable.filter((c) => c.suggested && !recentIds.includes(c.id)).map((c) => ({ kind: 'command', command: c }))
      return [
        { label: 'recent', rows: [...recent, ...lastDocs.map((doc): Row => ({ kind: 'doc', doc }))] },
        { label: 'suggested', rows: suggested },
      ].filter((s) => s.rows.length)
    }
    const commands = usable
      .map((c) => ({ c, score: matchScore(c.title, q) }))
      .filter((x) => x.score)
      .sort((a, b) => b.score - a.score)
    const found = searchDocuments(docs, q).results.map((r) => {
      const line = r.titleMatch ? undefined : r.hits[0]
      return { r, score: r.titleMatch ? matchScore(r.doc.title, q) + 0.5 : 0.5, hit: line && snippet(line.text, line.ranges[0]) }
    })
    found.sort((a, b) => b.score - a.score)
    const cmdRows: Row[] = commands.map((x) => ({ kind: 'command', command: x.c }))
    const docRows: Row[] = found.slice(0, 8).map((x) => ({ kind: 'doc', doc: x.r.doc, hit: x.hit }))
    const cmdBest = commands[0]?.score ?? 0
    const docBest = found[0]?.score ?? 0
    const cmdSection = { label: docBest > cmdBest ? 'commands' : undefined, rows: cmdRows }
    const docSection = { label: 'documents', rows: docRows }
    return (docBest > cmdBest ? [docSection, cmdSection] : [cmdSection, docSection]).filter((s) => s.rows.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, docs, settings])

  const rows = sections.flatMap((s) => s.rows)
  const current = rows[Math.min(at, rows.length - 1)]
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [at, query])

  const choose = (row: Row | undefined, beside = false) => {
    if (!row) return
    onClose()
    if (row.kind === 'command') runCommand(row.command)
    else if (beside) openBeside(row.doc.id)
    else openDocument(row.doc.id)
  }

  let index = -1
  const render = (row: Row): ReactNode => {
    index++
    const i = index
    const active = i === Math.min(at, rows.length - 1)
    const base = cn('flex h-[30px] items-center gap-2.5 border-l-2 pr-3.5 pl-3 text-[12.5px]', active ? 'border-primary bg-hover-lift' : 'border-transparent')
    if (row.kind === 'command') {
      const key = keysOf(row.command.id)[0]
      const state = row.command.state?.(ctx)
      return (
        <div key={`c-${row.command.id}`} role="option" aria-selected={active} data-active={active} className={base} onMouseMove={() => setAt(i)} onClick={() => choose(row)}>
          <span className="min-w-0 flex-auto truncate">
            <Marked text={row.command.title} range={matchRange(row.command.title, query)} />
          </span>
          {state && <span className="font-mono text-[11px] text-ink-tertiary">{state}</span>}
          {key && <span className="font-mono text-[11px] text-muted-foreground">{formatKey(key)}</span>}
        </div>
      )
    }
    return (
      <div key={`d-${row.doc.id}`} role="option" aria-selected={active} data-active={active} className={base} onMouseMove={() => setAt(i)} onClick={(e) => choose(row, e.metaKey || e.ctrlKey)}>
        <TagMark color={row.doc.color} className={cn('size-2', !row.doc.color && 'border border-ink-tertiary')} />
        <span className="flex min-w-0 flex-auto gap-2 truncate">
          <span dir="auto" className="truncate">
            <Marked text={row.doc.title} range={matchRange(row.doc.title, query)} />
          </span>
          {row.hit && (
            <span className="truncate text-ink-tertiary">
              · "<Marked text={row.hit.text} range={row.hit.range} />"
            </span>
          )}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">{query.trim() ? relativeTime(row.doc.updatedAt, now) : `document · ${relativeTime(row.doc.updatedAt, now)}`}</span>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-11 flex-none items-center gap-2.5 border-b border-border px-3.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setAt(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setAt((a) => Math.min(a + 1, rows.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setAt((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(current, e.metaKey || e.ctrlKey)
            }
          }}
          placeholder="type a command or a document name"
          aria-label="command or document"
          spellCheck={false}
          className="min-w-0 flex-auto bg-transparent text-[14px] outline-none placeholder:text-ink-dim"
        />
        <span className="font-mono text-[11px] text-muted-foreground">{formatKey(keysOf('palette')[0] ?? 'Mod-k')}</span>
      </div>
      <div ref={list} role="listbox" className="flex max-h-[360px] flex-col overflow-y-auto py-1.5">
        {rows.length === 0 ? (
          <div className="px-3.5 py-2 text-[12.5px] text-muted-foreground">nothing matches "{query.trim()}"</div>
        ) : (
          sections.map((s, si) => (
            <Fragment key={si}>
              {s.label && <span className={cn('px-3.5 pb-1 font-mono text-[11px] text-muted-foreground', si === 0 ? 'pt-1.5' : 'pt-2.5')}>{s.label}</span>}
              {s.rows.map(render)}
            </Fragment>
          ))
        )}
      </div>
      <div className="flex h-[30px] flex-none items-center gap-3.5 border-t border-border-subtle px-3.5 font-mono text-[11px] text-ink-tertiary">
        <span>↑↓ move</span>
        <span>↵ {current?.kind === 'doc' ? 'open' : 'run'}</span>
        {current?.kind === 'doc' && <span>{formatKey('Mod-enter').replace('Enter', '↵')} open beside</span>}
        <span className="flex-auto" />
        <span>esc close</span>
      </div>
    </>
  )
}
