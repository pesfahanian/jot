import { useLiveQuery } from 'dexie-react-hooks'
import { Check, KeyRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { JotDocument } from '@/lib/db'
import { getSettings, providerKey } from '@/lib/settings'
import { PROVIDERS } from '@/review/providers'
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
import { newDocument, renameDocument } from '@/state/actions'
import { useNow } from '@/state/hooks'
import { useReview } from '@/state/review'
import { focusedPane, useWorkspace } from '@/state/workspace'
import { DocumentMenu } from './DocumentMenu'
import { FilterIcon, PinIcon, PlusIcon, SearchIcon, SortIcon } from './icons'
import { tagClass } from './tagClass'
import { TagMark } from './TagMark'
import { Wordmark } from './Wordmark'

const iconButton =
  'flex h-5 w-6 flex-none items-center justify-center rounded-md border border-border bg-control text-secondary-foreground hover:text-foreground hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:text-ink-mute'

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
  return (
    <DocumentMenu doc={doc}>
      <div
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

// The AI provider's home (moved from the status bar, which holds only
// per-document state): one row pinned to the sidebar's foot. Named for the
// provider role, not OpenRouter, since more providers are planned. Two
// states — key set (tick) or not set (cross); the panel has the details.
function KeyFooter() {
  const settings = useLiveQuery(() => getSettings(), [])
  const provider = PROVIDERS[settings?.provider ?? 'openrouter']
  const key = settings ? providerKey(settings).key : null
  const open = useReview((s) => s.keyPanel.open)
  const openKeyPanel = useReview((s) => s.openKeyPanel)
  const closeKeyPanel = useReview((s) => s.closeKeyPanel)
  const set = !!key
  return (
    <button
      type="button"
      data-key-cell=""
      title={`AI provider: ${provider.label} — ${set ? 'key set' : 'no key set'}`}
      onClick={() => (open ? closeKeyPanel() : openKeyPanel('cell'))}
      className={cn(
        'flex h-[30px] flex-none items-center gap-2 border-t border-border pr-3 pl-3.5 font-mono text-[11.5px] text-secondary-foreground hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        open && 'bg-popover text-foreground',
      )}
    >
      <KeyRound size={13} strokeWidth={1.75} aria-hidden />
      <span className="flex-auto text-left">AI Provider</span>
      {set ? (
        <Check size={13} strokeWidth={2.25} className="text-primary" aria-label="set" />
      ) : (
        <X size={13} strokeWidth={2} className="text-muted-foreground" aria-label="not set" />
      )}
    </button>
  )
}

function FilterBox({ docs }: { docs: JotDocument[] }) {
  const colorFilter = useWorkspace((s) => s.colorFilter)
  const toggleColor = useWorkspace((s) => s.toggleColor)
  const clear = useWorkspace((s) => s.clearColorFilter)
  const counts = colorCounts(docs)
  const matching = filterByColors(docs, colorFilter).length
  const active = TAG_SLOTS.filter((c) => colorFilter.has(c))
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="filter by color"
          disabled={docs.length === 0}
          className={cn(iconButton, active.length && 'border-foreground bg-hover-lift hover:border-foreground')}
        >
          <FilterIcon active={active} muted={docs.length === 0} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[150px] overflow-hidden">
        <div className="grid grid-cols-2 p-[5px]">
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
  const selectedId = useWorkspace((s) => focusedPane(s)?.active)
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
  const toggleSort = useWorkspace((s) => s.toggleSort)
  const colorFilter = useWorkspace((s) => s.colorFilter)
  const clearColorFilter = useWorkspace((s) => s.clearColorFilter)
  const searchOpen = useWorkspace((s) => s.searchOpen)
  const query = useWorkspace((s) => s.searchQuery)
  const setSearch = useWorkspace((s) => s.setSearch)
  const selectedId = useWorkspace((s) => focusedPane(s)?.active)

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
            Nothing matches <span className="font-mono text-[12.5px]">{query.trim()}</span>
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
          No
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
      <header className="flex h-[38px] flex-none items-center gap-[5px] border-b border-border pr-2 pl-3.5">
        {searchOpen ? (
          <SearchField />
        ) : (
          <>
            <span className="flex flex-auto items-center text-foreground">
              <Wordmark />
            </span>
            <button type="button" title="new document" className={iconButton} onClick={() => void newDocument()}>
              <PlusIcon />
            </button>
            <button
              type="button"
              title={sort === 'date' ? 'sorted newest first — click for A to Z' : 'sorted A to Z — click for newest first'}
              disabled={empty}
              className={iconButton}
              onClick={toggleSort}
            >
              <SortIcon mode={sort} />
            </button>
            <FilterBox docs={docs} />
            <button type="button" title="search" disabled={empty} className={iconButton} onClick={() => setSearch(true)}>
              <SearchIcon />
            </button>
          </>
        )}
      </header>
      <div className="flex min-h-0 flex-auto flex-col overflow-y-auto">{body}</div>
      <KeyFooter />
    </aside>
  )
}
