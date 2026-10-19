import { Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { JotDocument } from '@/lib/db'
import { welcomeDocumentId } from '@/lib/welcome'
import { Keycap, KeycapPanel } from '@/components/review/Keycap'
import {
  arrangeDocuments,
  colorCounts,
  filterByColors,
  relativeTime,
  searchDocuments,
  TAG_SLOTS,
  type SearchResult,
} from '@/lib/docList'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatKey } from '@/lib/shortcuts'
import { newDocument, pickImport, renameDocument } from '@/state/actions'
import { useNow } from '@/state/hooks'
import { useUi } from '@/state/ui'
import { docIdOf } from '@/state/layout'
import { focusedPane, useWorkspace } from '@/state/workspace'
import { DocumentMenu } from './DocumentMenu'
import { FilterIcon, PinIcon, PlusIcon, SearchIcon } from './icons'
import { SidebarToggle } from './SidebarToggle'
import { tagClass } from './tagClass'
import { TagMark } from './TagMark'
import { Wordmark } from './Wordmark'

// Header icons (round 4): plain 24 × 20 marks in the secondary ink, a lift on
// hover.
const iconButton =
  'flex h-5 w-6 flex-none items-center justify-center rounded-sm text-secondary-foreground hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:text-ink-mute data-[state=open]:bg-hover-lift data-[state=open]:text-foreground'
const footButton =
  'flex h-[22px] items-center gap-1.5 rounded-md px-[7px] hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-hover-lift data-[state=open]:text-foreground'

// Secondary text button used by the empty states (6d).
export function QuietButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-6 items-center self-start rounded-md border border-border-strong bg-control px-[9px] font-mono text-[11px] text-secondary-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  )
}

function RenameField({ doc }: { doc: JotDocument }) {
  const setRenaming = useWorkspace((s) => s.setRenaming)
  const [value, setValue] = useState(doc.title)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' })
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (commit: boolean) => {
    if (done.current) return
    done.current = true
    if (commit) void renameDocument(doc.id, value)
    setRenaming(null)
  }
  return (
    <input
      ref={ref}
      value={value}
      aria-label="document name"
      data-rename-field=""
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        // preventDefault: focus moves to the editor inside this handler, and
        // the Enter would otherwise land there as a newline.
        if (e.key === 'Enter') {
          e.preventDefault()
          finish(true)
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          finish(false)
        }
      }}
      onBlur={() => finish(true)}
      className="-my-px min-w-0 flex-auto rounded-sm border border-primary bg-document px-1 text-[13px] text-foreground outline-none"
    />
  )
}

function FileRow({ doc, selected, now }: { doc: JotDocument; selected: boolean; now: number }) {
  const renaming = useWorkspace((s) => s.renamingId === doc.id)
  const openDocument = useWorkspace((s) => s.openDocument)
  const setRenaming = useWorkspace((s) => s.setRenaming)
  const setDragTab = useWorkspace((s) => s.setDragTab)
  return (
    <DocumentMenu doc={doc}>
      <div
        // Drag into the panes to open it there (Phase 8, as VSCode's
        // explorer): a tab strip, a pane's middle, or its edge for a new
        // column. Not while its name is being edited.
        draggable={!renaming}
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-jot-tab', doc.id)
          e.dataTransfer.effectAllowed = 'move'
          setDragTab({ docId: doc.id, from: null })
        }}
        onDragEnd={() => setDragTab(null)}
        role="button"
        tabIndex={0}
        data-doc-id={doc.id}
        onClick={() => openDocument(doc.id)}
        // Double-click anywhere on the row renames (the first click has
        // already opened the document).
        onDoubleClick={() => !renaming && setRenaming(doc.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openDocument(doc.id)
          }
        }}
        className={cn(
          'flex cursor-default items-center gap-2 border-l-2 py-[5px] pr-3 pl-2.5 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          selected ? 'border-primary bg-popover' : 'border-transparent hover:bg-row-hover',
        )}
      >
        <TagMark color={doc.color} className="size-2" />
        <span className="flex w-[7px] flex-none text-secondary-foreground">{doc.pinned && <PinIcon />}</span>
        {renaming ? (
          <RenameField doc={doc} />
        ) : (
          <span className={cn('flex-auto truncate text-[13px]', selected ? 'font-medium text-foreground' : 'text-secondary-foreground')}>
            {doc.title}
          </span>
        )}
        <span className="flex-none font-mono text-[11px] text-muted-foreground">{relativeTime(doc.updatedAt, now)}</span>
      </div>
    </DocumentMenu>
  )
}

// The guide card (Phase 10): the shortcuts worth knowing, as keycaps, and a
// quiet way back to the welcome document — the person's own copy if it
// still exists, else a fresh one (lib/welcome.ts).
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'
const SHIFT = isMac ? '⇧' : 'Shift'
const GUIDE: { keys: string[]; does: string }[] = [
  { keys: [MOD, SHIFT, 'V'], does: 'rendered view' },
  { keys: [MOD, SHIFT, 'I'], does: 'format the document' },
  { keys: [MOD, 'F'], does: 'find and replace' },
  { keys: [MOD, 'Z'], does: 'undo, including a whole format or apply' },
]
function GuideButton() {
  const [open, setOpen] = useState(false)
  const openDocument = useWorkspace((s) => s.openDocument)
  const openWelcome = async () => {
    setOpen(false)
    openDocument(await welcomeDocumentId())
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="guide"
          title="guide"
          className={iconButton}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={12} className="w-[340px] border-0 bg-transparent p-0 shadow-none">
        <KeycapPanel className="flex flex-col overflow-hidden">
          <div className="border-b border-border px-4 pt-3 pb-2.5 text-[15px] font-semibold tracking-[-0.02em]">guide</div>
          <div className="flex flex-col gap-2 px-4 py-3">
            {GUIDE.map((g) => (
              <div key={g.does} className="flex items-center gap-3">
                <span className="flex w-[92px] flex-none gap-1">
                  {g.keys.map((k) => (
                    <Keycap key={k}>{k}</Keycap>
                  ))}
                </span>
                <span className="text-[12.5px] text-secondary-foreground">{g.does}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 border-t border-border px-4 py-3 text-[12.5px] leading-relaxed text-secondary-foreground">
            <span>Drag tabs to reorder or split, and documents in from the sidebar. Right-click a document for colour, rename, pin and delete.</span>
          </div>
          <button
            type="button"
            onClick={() => void openWelcome()}
            className="border-t border-border px-4 py-2.5 text-left font-mono text-[11.5px] text-muted-foreground hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            open the welcome document
          </button>
        </KeycapPanel>
      </PopoverContent>
    </Popover>
  )
}

// Sort and colour filter share one button and one menu (round 4). The face
// is three falling lines; while a filter is on it shows what's filtered.
function SortFilterBox({ docs }: { docs: JotDocument[] }) {
  const sort = useWorkspace((s) => s.sort)
  const toggleSort = useWorkspace((s) => s.toggleSort)
  const colorFilter = useWorkspace((s) => s.colorFilter)
  const toggleColor = useWorkspace((s) => s.toggleColor)
  const clear = useWorkspace((s) => s.clearColorFilter)
  const counts = colorCounts(docs)
  const matching = filterByColors(docs, colorFilter).length
  const active = TAG_SLOTS.filter((c) => colorFilter.has(c))
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" title="sort and filter" disabled={docs.length === 0} className={cn(iconButton, active.length && 'bg-hover-lift')}>
          {active.length ? (
            <FilterIcon active={active} />
          ) : (
            <span className="flex flex-col items-center gap-0.5" aria-hidden>
              <span className="h-[1.5px] w-2.5 bg-current" />
              <span className="h-[1.5px] w-[7px] bg-current" />
              <span className="h-[1.5px] w-1 bg-current" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[176px] overflow-hidden">
        <div className="px-[9px] pt-2 pb-1 font-mono text-[11px] text-muted-foreground">sort</div>
        <div className="flex gap-1 px-[5px] pb-1.5">
          {(['date', 'name'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={sort === m}
              onClick={() => sort !== m && toggleSort()}
              className={cn(
                'flex h-[22px] flex-1 items-center justify-center rounded-md border font-mono text-[11px]',
                sort === m ? 'border-ink-tertiary bg-hover-lift text-foreground' : 'border-border bg-background text-secondary-foreground hover:text-foreground',
              )}
            >
              {m === 'date' ? 'newest' : 'a to z'}
            </button>
          ))}
        </div>
        <div className="border-t border-border-subtle px-[9px] pt-2 pb-1 font-mono text-[11px] text-muted-foreground">filter by colour</div>
        <div className="grid grid-cols-2 px-[5px] pb-[5px]">
          {TAG_SLOTS.map((c) => {
            const selected = colorFilter.has(c)
            // A 0-count swatch can't be picked — it could only ever empty the list.
            const dead = counts[c] === 0 && !selected
            return (
              <button
                key={c}
                type="button"
                disabled={dead}
                onClick={() => toggleColor(c)}
                className={cn(
                  'flex items-center gap-[7px] rounded-sm border px-[5px] py-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  selected ? 'border-foreground bg-inset' : 'border-transparent hover:bg-hover-lift',
                )}
              >
                <span className={cn('size-[11px] rounded-sm', tagClass(c))} />
                <span
                  className={cn(
                    'font-mono text-[11px]',
                    selected ? 'font-semibold text-foreground' : dead ? 'text-ink-dim' : 'text-ink-tertiary',
                  )}
                >
                  {counts[c]}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border-subtle px-[9px] py-1.5 font-mono text-[11px] text-muted-foreground">
          <span>
            {matching} of {docs.length}
          </span>
          {active.length > 0 && (
            <button type="button" onClick={clear} className="text-secondary-foreground underline underline-offset-2 hover:text-foreground">
              clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function highlight(text: string, ranges: [number, number][]) {
  const out: ReactNode[] = []
  let at = 0
  ranges.forEach(([a, b], i) => {
    if (a > at) out.push(text.slice(at, a))
    out.push(
      <span key={i} className="bg-mark text-foreground">
        {text.slice(a, b)}
      </span>,
    )
    at = b
  })
  out.push(text.slice(at))
  return out
}

function SearchResults({ results, matches, now }: { results: SearchResult[]; matches: number; now: number }) {
  const openDocument = useWorkspace((s) => s.openDocument)
  // A rendered tab selects its document too.
  const selectedId = useWorkspace((s) => { const a = focusedPane(s)?.active; return a ? docIdOf(a) : undefined })
  return (
    <>
      <div className="border-b border-border-subtle px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
        {matches} {matches === 1 ? 'match' : 'matches'} in {results.length} {results.length === 1 ? 'document' : 'documents'}
      </div>
      {results.map(({ doc, titleMatch, hits }) => (
        <DocumentMenu key={doc.id} doc={doc}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => openDocument(doc.id, { line: hits[0]?.line })}
            onKeyDown={(e) => e.key === 'Enter' && openDocument(doc.id, { line: hits[0]?.line })}
            className={cn(
              'flex cursor-default flex-col gap-0.5 border-l-2 py-[5px] pr-3 pl-2.5 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
              doc.id === selectedId ? 'border-primary bg-popover' : 'border-transparent hover:bg-row-hover',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="flex-auto truncate text-[13px] text-foreground">{doc.title}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{relativeTime(doc.updatedAt, now)}</span>
            </div>
            {hits.length === 0 && titleMatch && <span className="font-mono text-[11px] text-muted-foreground">title match</span>}
            {hits.map((h) => (
              <span
                key={h.line}
                onClick={(e) => {
                  e.stopPropagation()
                  openDocument(doc.id, { line: h.line })
                }}
                className="truncate font-mono text-[11px] text-secondary-foreground hover:text-foreground"
              >
                <span className="text-muted-foreground">{h.line} </span>
                {highlight(h.text.trimEnd(), h.ranges)}
              </span>
            ))}
          </div>
        </DocumentMenu>
      ))}
    </>
  )
}

function SearchField() {
  const query = useWorkspace((s) => s.searchQuery)
  const setSearch = useWorkspace((s) => s.setSearch)
  return (
    <>
      <input
        autoFocus
        value={query}
        aria-label="search documents"
        spellCheck={false}
        placeholder="search"
        onChange={(e) => setSearch(true, e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setSearch(false)}
        className="h-6 min-w-0 flex-auto rounded-md border border-border bg-background px-2 font-mono text-[12px] text-foreground outline-none placeholder:text-ink-dim focus:border-primary"
      />
      <button type="button" onClick={() => setSearch(false)} className="px-1 font-mono text-[11px] text-muted-foreground hover:text-foreground">
        esc
      </button>
    </>
  )
}

export function Sidebar({ docs }: { docs: JotDocument[] }) {
  const now = useNow()
  const width = useWorkspace((s) => s.sidebarWidth)
  const sort = useWorkspace((s) => s.sort)
  const openSettings = useUi((s) => s.openSettings)
  const colorFilter = useWorkspace((s) => s.colorFilter)
  const clearColorFilter = useWorkspace((s) => s.clearColorFilter)
  const searchOpen = useWorkspace((s) => s.searchOpen)
  const query = useWorkspace((s) => s.searchQuery)
  const setSearch = useWorkspace((s) => s.setSearch)
  // A rendered tab selects its document too.
  const selectedId = useWorkspace((s) => { const a = focusedPane(s)?.active; return a ? docIdOf(a) : undefined })

  const { pinned, rest } = useMemo(() => arrangeDocuments(filterByColors(docs, colorFilter), sort), [docs, colorFilter, sort])
  const search = useMemo(() => (searchOpen && query.trim() ? searchDocuments(docs, query) : null), [docs, searchOpen, query])
  const empty = docs.length === 0
  const activeColors = TAG_SLOTS.filter((c) => colorFilter.has(c))

  let body: ReactNode
  if (search) {
    body =
      search.results.length > 0 ? (
        <SearchResults results={search.results} matches={search.matches} now={now} />
      ) : (
        // No search results (6d): state the scope searched, offer the query as a title.
        <div className="flex flex-col gap-3 px-3.5 py-[18px]">
          <div className="text-[13px] leading-normal">
            nothing matches <span className="font-mono text-[12.5px]">{query.trim()}</span>
          </div>
          <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            searched {docs.length} {docs.length === 1 ? 'title' : 'titles'} and their full text
          </div>
          <QuietButton
            onClick={() => {
              void newDocument(query.trim())
              setSearch(false)
            }}
          >
            new document "{query.trim()}"
          </QuietButton>
        </div>
      )
  } else if (!empty && pinned.length + rest.length === 0) {
    // No filter matches (6d). Only reachable when the last matching document
    // is recolored or deleted mid-filter — 0-count swatches can't be picked.
    body = (
      <div className="flex flex-col gap-3 px-3.5 py-[18px]">
        <div className="flex items-center gap-[7px] text-[13px]">
          no
          {activeColors.map((c) => (
            <span key={c} className={cn('size-[9px] rounded-[2px]', tagClass(c))} />
          ))}
          documents
        </div>
        <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          {activeColors.length === 1 ? 'none left with this color' : 'none left with these colors'}
        </div>
        <QuietButton onClick={clearColorFilter}>clear filter</QuietButton>
      </div>
    )
  } else {
    body = (
      <>
        {pinned.length > 0 && (
          <div className={cn('flex flex-col py-1.5', rest.length > 0 && 'border-b border-border')}>
            {pinned.map((d) => (
              <FileRow key={d.id} doc={d} selected={d.id === selectedId} now={now} />
            ))}
          </div>
        )}
        {rest.length > 0 && (
          <div className="flex flex-col py-1.5">
            {rest.map((d) => (
              <FileRow key={d.id} doc={d} selected={d.id === selectedId} now={now} />
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <aside
      style={{ width }}
      className="flex min-h-0 flex-none flex-col overflow-hidden rounded-(--radius-panel) border border-border-strong bg-card"
    >
      <header className="flex h-[38px] flex-none items-center gap-0.5 border-b border-border pr-1.5 pl-3.5">
        {searchOpen ? (
          <SearchField />
        ) : (
          <>
            <span className="flex flex-auto items-center text-foreground">
              <Wordmark />
            </span>
            <button type="button" title={`new document (${formatKey('Mod-Alt-n')})`} className={iconButton} onClick={() => void newDocument()}>
              <PlusIcon />
            </button>
            <button type="button" title={`search (${formatKey('Mod-Shift-f')})`} disabled={empty} className={iconButton} onClick={() => setSearch(true)}>
              <SearchIcon />
            </button>
            <SortFilterBox docs={docs} />
            <span className="mx-[3px] h-3.5 w-px bg-border" />
            <SidebarToggle />
          </>
        )}
      </header>
      {/* Double-click the empty space below the rows: a new document. A
          faint hint says so while the list has room (round 4). */}
      <div
        className="flex min-h-0 flex-auto flex-col overflow-y-auto"
        onDoubleClick={(e) => {
          if ((e.target === e.currentTarget || (e.target as Element).hasAttribute('data-list-hint')) && !search) void newDocument()
        }}
      >
        {body}
        {!search && !empty && (
          <span data-list-hint="" className="flex min-h-0 flex-auto items-end justify-center overflow-hidden pb-2.5 font-mono text-[11px] text-ink-dim select-none">
            double-click for a new document
          </span>
        )}
      </div>
      {/* The foot (round 4): settings, import, the guide. The AI provider
          and the theme live in settings now. */}
      <div className="flex h-[34px] flex-none items-center gap-0.5 border-t border-border pr-1.5 pl-2 font-mono text-[11px] text-secondary-foreground">
        <button type="button" onClick={() => openSettings()} className={footButton} title="settings">
          <Settings2 size={13} strokeWidth={1.75} aria-hidden />
          settings
        </button>
        <span className="flex-auto text-ink-dim">{formatKey('Mod-,')}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={footButton} title="import documents">
              import…
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem onSelect={() => pickImport('files')} title=".md, .txt or a workspace .zip — several at once">
              files…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => pickImport('folder')} title="every .md and .txt in a folder, and its subfolders">
              a folder…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <GuideButton />
      </div>
    </aside>
  )
}
