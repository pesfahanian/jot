import { history } from '@codemirror/commands'
import { getChunks, getOriginalDoc, goToNextChunk, goToPreviousChunk, MergeView, unifiedMergeView, type Chunk } from '@codemirror/merge'
import { EditorState, type Extension, type Text } from '@codemirror/state'
import { drawSelection, EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Check } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { directionExtension } from '@/editor/direction'
import { editorKeymap } from '@/editor/keymap'
import { getSession, openContent } from '@/editor/sessions'
import { jotEditorTheme } from '@/editor/theme'
import { db, type Comparison, type DiffSide, type JotDocument } from '@/lib/db'
import { diffOverride } from '@/lib/diffText'
import { arrangeDocuments, relativeTime } from '@/lib/docList'
import { cn } from '@/lib/utils'
import { pickerRequests } from '@/state/actions'
import { useDocuments, useNow } from '@/state/hooks'
import { comparisonIdOf } from '@/state/layout'
import { useWorkspace } from '@/state/workspace'
import { TagMark } from '@/components/shell/TagMark'

// The diff checker (design accepted 2026-10-05; frames in docs/design/
// diff-checker/): a diff tab in two stages. Input: fill "original" and
// "changed" from a document or by pasting. Result: the diff, split or
// unified, with both sides still editable — a document side is the
// document itself (shared session, autosaved), a pasted side is scratch.

type SideName = 'left' | 'right'
const LABEL: Record<SideName, string> = { left: 'original', right: 'changed' }
// Below this pane width the result shows unified; the split preference is
// kept and comes back when the pane widens.
const NARROW = 560

const control =
  'flex h-[22px] items-center gap-1.5 rounded-md border px-2 font-mono text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45'
const quiet = cn(control, 'border-border bg-background text-secondary-foreground hover:text-foreground')
const segOn = 'bg-hover-lift text-foreground'
const segOff = 'text-secondary-foreground hover:text-foreground'

function Segmented<T extends string>({ value, options, onChange, labels, dim }: { value: T; options: readonly T[]; onChange: (v: T) => void; labels?: Partial<Record<T, string>>; dim?: T }) {
  return (
    <div className="flex h-[22px] overflow-hidden rounded-md border border-border font-mono text-[11px]">
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={cn('px-2', i > 0 && 'border-l border-border', o === value ? segOn : segOff, o === dim && 'opacity-45')}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  )
}

function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-secondary-foreground hover:text-foreground">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="accent-(--primary)" />
      {children}
    </label>
  )
}

// The text a side holds right now.
function sideText(side: DiffSide, doc: JotDocument | undefined): string {
  if (side.kind === 'doc') return doc ? (openContent(doc.id) ?? doc.content) : ''
  return side.kind === 'paste' ? side.text : ''
}

// ---- editors ----

// First edit to a document side, per comparison: say it's the real document.
const noticed = new Set<string>()

interface SideBinding {
  side: DiffSide
  doc: JotDocument | undefined
  comparisonId: string
  onScratch: (text: string) => void
}

// What every side editor carries: the editor's look, its keys, Farsi
// direction, and the link to its source — the document's shared session
// (so other panes stay in step and it autosaves) or the scratch text.
function sideExtensions(b: SideBinding, extra: Extension[] = []): { ext: Extension; attach: (view: EditorView) => () => void } {
  let scratchTimer: ReturnType<typeof setTimeout> | undefined
  const session = b.side.kind === 'doc' && b.doc ? getSession(b.doc.id, b.doc.content) : null
  const ext: Extension = [
    lineNumbers(),
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    keymap.of(editorKeymap),
    jotEditorTheme,
    directionExtension('auto'),
    placeholder('Paste or type text here.'),
    EditorView.contentAttributes.of({ spellcheck: 'true' }),
    ...extra,
    EditorView.updateListener.of((u) => {
      if (!u.docChanged) return
      if (session) {
        session.handleUpdate(u)
        const typed = u.transactions.some((tr) => tr.isUserEvent('input') || tr.isUserEvent('delete'))
        if (typed && !noticed.has(b.comparisonId)) {
          noticed.add(b.comparisonId)
          useWorkspace.getState().showToast({ kind: 'notice', id: Date.now(), lead: `editing ${b.doc!.title}:`, detail: 'changes save to the document' })
        }
      } else {
        clearTimeout(scratchTimer)
        const text = u.state.doc.toString()
        scratchTimer = setTimeout(() => b.onScratch(text), 250)
      }
    }),
  ]
  return { ext, attach: (view) => (session ? session.attach(view) : () => clearTimeout(scratchTimer)) }
}

// One editor per side for the input stage. A scratch side stays the same
// editor as it goes from empty to pasted text; text set from outside (the
// paste button, a dropped file, clear) replaces what's there, while the
// side's own typing, saved a moment later, never comes back to overwrite
// newer keystrokes.
function InputEditor({ binding }: { binding: SideBinding }) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const sent = useRef<string | null>(null)
  const bindingRef = useRef(binding)
  useLayoutEffect(() => {
    bindingRef.current = binding
  })
  const key = binding.side.kind === 'doc' ? `doc:${binding.side.docId}` : 'scratch'
  useEffect(() => {
    const b = bindingRef.current
    const { ext, attach } = sideExtensions({
      ...b,
      onScratch: (t) => {
        sent.current = t
        bindingRef.current.onScratch(t)
      },
    })
    const view = new EditorView({ parent: host.current!, state: EditorState.create({ doc: sideText(b.side, b.doc), extensions: ext }) })
    viewRef.current = view
    const detach = attach(view)
    return () => {
      detach()
      view.destroy()
      viewRef.current = null
    }
  }, [key])
  const scratch = binding.side.kind === 'doc' ? null : sideText(binding.side, undefined)
  useEffect(() => {
    const view = viewRef.current
    if (scratch === null || !view || scratch === sent.current || scratch === view.state.doc.toString()) return
    sent.current = scratch
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: scratch } })
  }, [scratch])
  return <div ref={host} className="min-h-0 flex-auto overflow-auto [&_.cm-editor]:h-full" />
}

// ---- counts ----

interface Counts {
  removed: number
  added: number
}
function linesIn(doc: Text, from: number, to: number): number {
  if (to <= from) return 0
  return doc.lineAt(Math.max(from, to - 1)).number - doc.lineAt(from).number + 1
}
function countChunks(chunks: readonly Chunk[], a: Text, b: Text): Counts {
  let removed = 0
  let added = 0
  for (const c of chunks) {
    removed += linesIn(a, c.fromA, c.toA)
    added += linesIn(b, c.fromB, c.toB)
  }
  return { removed, added }
}

// ---- the result ----

interface ResultHandle {
  next: () => void
  prev: () => void
}

function ResultEditors({
  cmp,
  left,
  right,
  unified,
  onCounts,
  handle,
}: {
  cmp: Comparison
  left: SideBinding
  right: SideBinding
  unified: boolean
  onCounts: (c: Counts) => void
  handle: React.RefObject<ResultHandle | null>
}) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ left, right, onCounts })
  useLayoutEffect(() => {
    latest.current = { left, right, onCounts }
  })
  const sideKey = (s: DiffSide) => (s.kind === 'doc' ? `doc:${s.docId}` : s.kind)
  // Rebuilt when how it compares, how it's laid out, or a side's source
  // changes; text edits flow through without a rebuild.
  const key = [unified, cmp.hideUnchanged, cmp.ignoreWhitespace, cmp.precision, sideKey(left.side), sideKey(right.side)].join('|')

  useEffect(() => {
    const { left: l, right: r } = latest.current
    const scratch = (name: SideName) => (t: string) => latest.current[name].onScratch(t)
    const diffConfig = { override: diffOverride(cmp.precision, cmp.ignoreWhitespace) }
    const collapseUnchanged = cmp.hideUnchanged ? { margin: 0, minSize: 3 } : undefined
    const report = (state: EditorState, a: Text) => {
      const chunks = getChunks(state)?.chunks ?? []
      latest.current.onCounts(countChunks(chunks, a, state.doc))
    }
    const detaches: (() => void)[] = []
    let destroy: () => void
    if (unified) {
      const rb = sideExtensions({ ...r, onScratch: scratch('right') }, [
        unifiedMergeView({ original: sideText(l.side, l.doc), gutter: true, highlightChanges: true, mergeControls: false, collapseUnchanged, diffConfig }),
        EditorView.updateListener.of((u) => report(u.state, getOriginalDoc(u.state))),
      ])
      const view = new EditorView({ parent: host.current!, state: EditorState.create({ doc: sideText(r.side, r.doc), extensions: rb.ext }) })
      detaches.push(rb.attach(view))
      report(view.state, getOriginalDoc(view.state))
      handle.current = { next: () => goToNextChunk(view) && view.focus(), prev: () => goToPreviousChunk(view) && view.focus() }
      destroy = () => view.destroy()
    } else {
      let mv: MergeView | null = null
      const update = () => mv && report(mv.b.state, mv.a.state.doc)
      const la = sideExtensions({ ...l, onScratch: scratch('left') }, [EditorView.updateListener.of(() => queueMicrotask(update))])
      const rb = sideExtensions({ ...r, onScratch: scratch('right') }, [EditorView.updateListener.of(() => queueMicrotask(update))])
      mv = new MergeView({
        parent: host.current!,
        a: { doc: sideText(l.side, l.doc), extensions: la.ext },
        b: { doc: sideText(r.side, r.doc), extensions: rb.ext },
        gutter: true,
        highlightChanges: true,
        collapseUnchanged,
        diffConfig,
      })
      detaches.push(la.attach(mv.a), rb.attach(mv.b))
      update()
      const view = mv.b
      handle.current = { next: () => goToNextChunk(view) && view.focus(), prev: () => goToPreviousChunk(view) && view.focus() }
      destroy = () => mv!.destroy()
    }
    return () => {
      for (const d of detaches) d()
      destroy()
      handle.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return <div ref={host} className="jot-diff min-h-0 flex-auto overflow-auto [&_.cm-mergeView]:min-h-full" />
}

// ---- the picker ----

function Picker({ docs, other, onPick, onClose }: { docs: JotDocument[]; other?: { docId: string; label: string }; onPick: (d: JotDocument) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const now = useNow()
  const sort = useWorkspace((s) => s.sort)
  const { pinned, rest } = arrangeDocuments(docs, sort)
  const all = [...pinned, ...rest].filter((d) => d.title.toLowerCase().includes(q.trim().toLowerCase()))
  const pickable = all.filter((d) => d.id !== other?.docId)
  const choose = (d: JotDocument | undefined) => d && d.id !== other?.docId && onPick(d)
  return (
    <div className="flex w-[300px] flex-col p-1">
      <input
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setAt(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setAt((a) => Math.min(a + 1, pickable.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAt((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            choose(pickable[at])
          } else if (e.key === 'Escape') onClose()
        }}
        placeholder="filter documents"
        aria-label="filter documents"
        className="mb-1 h-8 rounded-md border border-primary bg-background px-2.5 text-[13px] outline-none placeholder:text-ink-dim"
      />
      <div className="max-h-[300px] overflow-y-auto">
        {all.map((d) => {
          const disabled = d.id === other?.docId
          const active = !disabled && pickable[at]?.id === d.id
          return (
            <button
              key={d.id}
              type="button"
              disabled={disabled}
              onMouseEnter={() => !disabled && setAt(pickable.indexOf(d))}
              onClick={() => choose(d)}
              className={cn('flex h-[30px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px]', active && 'bg-hover-lift', disabled ? 'text-ink-dim' : 'text-secondary-foreground hover:text-foreground')}
            >
              <TagMark color={d.color} className="size-[7px]" />
              <span className="min-w-0 flex-auto truncate">{d.title}</span>
              <span className="flex-none font-mono text-[11px] text-muted-foreground">{disabled ? `on ${other!.label}` : relativeTime(d.updatedAt, now)}</span>
            </button>
          )
        })}
        {all.length === 0 && <div className="px-2.5 py-2 text-[12.5px] text-muted-foreground">nothing matches</div>}
      </div>
      <div className="mt-1 flex gap-3 border-t border-border-subtle px-2.5 pt-1.5 pb-1 font-mono text-[10.5px] text-muted-foreground">
        <span>↑↓ move</span>
        <span>↵ open</span>
        <span>esc close</span>
      </div>
    </div>
  )
}

// ---- the view ----

export function DiffView({ tabId }: { tabId: string; paneId: string }) {
  const id = comparisonIdOf(tabId)
  const found = useLiveQuery(() => db.comparisons.get(id).then((c) => ({ c })), [id])
  const docs = useDocuments()
  const self = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1000)
  const [counts, setCounts] = useState<Counts>({ removed: 0, added: 0 })
  const [picking, setPicking] = useState<SideName | null>(null)
  const handle = useRef<ResultHandle | null>(null)

  // A diff tab whose comparison is gone (cleared storage) starts empty.
  useEffect(() => {
    if (found && !found.c)
      void db.comparisons.put({ id, left: { kind: 'empty' }, right: { kind: 'empty' }, stage: 'input', layout: 'split', hideUnchanged: false, ignoreWhitespace: false, precision: 'word', createdAt: Date.now() })
  }, [found, id])

  // "compare with…": the picker opens on the changed side.
  useEffect(() => {
    if (pickerRequests.delete(id)) setTimeout(() => setPicking('right'), 150)
  }, [id])

  useEffect(() => {
    const el = self.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cmp = found?.c
  const byId = useMemo(() => new Map((docs ?? []).map((d) => [d.id, d])), [docs])
  if (!cmp || !docs) return <div ref={self} className="flex-auto" />

  const update = (patch: Partial<Comparison>) => void db.comparisons.update(id, patch)
  const docOf = (s: DiffSide) => (s.kind === 'doc' ? byId.get(s.docId) : undefined)
  // A side whose document was deleted reads as empty.
  const live = (s: DiffSide): DiffSide => (s.kind === 'doc' && !byId.has(s.docId) ? { kind: 'empty' } : s)
  const sides = { left: live(cmp.left), right: live(cmp.right) }
  const binding = (name: SideName): SideBinding => ({
    side: sides[name],
    doc: docOf(sides[name]),
    comparisonId: id,
    onScratch: (text) => update({ [name]: { kind: 'paste', text } } as Partial<Comparison>),
  })
  const hasText = (name: SideName) => sideText(sides[name], docOf(sides[name])).trim().length > 0
  const ready = hasText('left') && hasText('right')
  const narrow = width < NARROW
  const unified = narrow || cmp.layout === 'unified'
  const result = cmp.stage === 'result'

  const find = () => ready && update({ stage: 'result' })
  const clear = () => {
    useWorkspace.getState().showToast({ kind: 'cleared', id: Date.now(), comparison: cmp })
    update({ left: { kind: 'empty' }, right: { kind: 'empty' }, stage: 'input' })
  }
  const pick = (name: SideName, d: JotDocument) => {
    setPicking(null)
    update({ [name]: { kind: 'doc', docId: d.id } } as Partial<Comparison>)
  }
  const pasteInto = async (name: SideName) => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) update({ [name]: { kind: 'paste', text } } as Partial<Comparison>)
    } catch {
      /* clipboard read refused: the editor takes Cmd/Ctrl+V */
    }
  }
  const dropInto = async (name: SideName, files: FileList) => {
    const f = [...files].find((x) => /\.(md|markdown|txt)$/i.test(x.name))
    if (f) update({ [name]: { kind: 'paste', text: await f.text() } } as Partial<Comparison>)
  }

  const sideHeader = (name: SideName) => {
    const s = sides[name]
    const d = docOf(s)
    const other = sides[name === 'left' ? 'right' : 'left']
    const lines = sideText(s, d).split('\n').length
    return (
      <div className="flex h-8 flex-none items-center gap-2 border-b border-border-subtle px-3 font-mono text-[11px] text-muted-foreground">
        <span>{LABEL[name]}</span>
        {s.kind === 'doc' && d ? (
          <>
            <TagMark color={d.color} className="size-[7px]" />
            <span className="min-w-[4ch] truncate font-sans text-[13px] font-medium text-foreground">{d.title}</span>
            {/* The hint gives way before the name does. */}
            <span className="min-w-0 shrink-[8] truncate">document · edits save</span>
          </>
        ) : s.kind === 'paste' ? (
          <>
            <span className="font-sans text-[13px] font-medium text-foreground">pasted text</span>
            <span>scratch</span>
          </>
        ) : (
          <span>empty</span>
        )}
        <span className="flex-auto" />
        {s.kind !== 'empty' && (
          <>
            <span className="flex-none tabular-nums">{lines} lines</span>
            <Popover open={picking === name} onOpenChange={(o) => setPicking(o ? name : null)}>
              <PopoverAnchor asChild>
                <button type="button" onClick={() => setPicking(name)} className={quiet}>
                  change
                </button>
              </PopoverAnchor>
              <PopoverContent align="end" className="w-auto p-0">
                <Picker docs={docs} other={other.kind === 'doc' ? { docId: other.docId, label: LABEL[name === 'left' ? 'right' : 'left'] } : undefined} onPick={(doc) => pick(name, doc)} onClose={() => setPicking(null)} />
              </PopoverContent>
            </Popover>
            <button type="button" aria-label={`empty the ${LABEL[name]} side`} title="empty this side" onClick={() => update({ [name]: { kind: 'empty' } } as Partial<Comparison>)} className="px-1 text-[13px] hover:text-foreground">
              ×
            </button>
          </>
        )}
      </div>
    )
  }

  const inputSide = (name: SideName) => {
    const s = sides[name]
    const other = sides[name === 'left' ? 'right' : 'left']
    return (
      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        onDragOver={(e) => e.dataTransfer.types.includes('Files') && (e.preventDefault(), e.stopPropagation())}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          e.stopPropagation()
          void dropInto(name, e.dataTransfer.files)
        }}
      >
        {sideHeader(name)}
        <InputEditor binding={binding(name)} key={s.kind === 'doc' ? s.docId : 'scratch'} />
        {s.kind === 'empty' && (
          <div className="pointer-events-none absolute inset-x-0 top-8 bottom-0 flex flex-col items-center justify-center gap-2.5">
            <div className="pointer-events-auto flex gap-1.5">
              <Popover open={picking === name} onOpenChange={(o) => setPicking(o ? name : null)}>
                <PopoverAnchor asChild>
                  <button type="button" onClick={() => setPicking(name)} className={quiet}>
                    open document <span className="text-muted-foreground">▾</span>
                  </button>
                </PopoverAnchor>
                <PopoverContent align="center" className="w-auto p-0">
                  <Picker docs={docs} other={other.kind === 'doc' ? { docId: other.docId, label: LABEL[name === 'left' ? 'right' : 'left'] } : undefined} onPick={(doc) => pick(name, doc)} onClose={() => setPicking(null)} />
                </PopoverContent>
              </Popover>
              <button type="button" onClick={() => void pasteInto(name)} className={quiet}>
                paste
              </button>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">or drop a .md file</span>
          </div>
        )}
      </div>
    )
  }

  const identical = result && counts.removed === 0 && counts.added === 0
  return (
    <div
      ref={self}
      className="flex min-h-0 flex-auto flex-col"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !result) {
          e.preventDefault()
          find()
        }
      }}
    >
      {/* The options strip: what changes the comparison shows before the
          first run; the rest only once there's a result. */}
      <div className="flex min-h-[38px] flex-none flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-3 py-1.5">
        {result && <Segmented value={cmp.layout} options={['split', 'unified'] as const} onChange={(layout) => update({ layout })} dim={narrow ? 'split' : undefined} />}
        {result && (
          <Toggle on={cmp.hideUnchanged} onChange={(hideUnchanged) => update({ hideUnchanged })}>
            hide unchanged lines
          </Toggle>
        )}
        <Toggle on={cmp.ignoreWhitespace} onChange={(ignoreWhitespace) => update({ ignoreWhitespace })}>
          ignore whitespace
        </Toggle>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">precision</span>
          <Segmented value={cmp.precision} options={['word', 'char'] as const} labels={{ char: 'character' }} onChange={(precision) => update({ precision })} />
        </div>
        <span className="flex-auto" />
        {result && (
          <>
            <span className={cn('flex items-center gap-3 font-mono text-[11px]', identical ? 'text-ink-dim' : 'text-secondary-foreground')}>
              <span className="flex items-center gap-1.5">
                <span className={cn('size-[6px] rounded-full', identical ? 'bg-ink-mute' : 'bg-diff-del')} />
                {counts.removed} removed
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn('size-[6px] rounded-full', identical ? 'bg-ink-mute' : 'bg-diff-add')} />
                {counts.added} added
              </span>
            </span>
            <div className="flex gap-1">
              <button type="button" aria-label="previous change" title="previous change" disabled={identical} onClick={() => handle.current?.prev()} className={cn(quiet, 'px-1.5')}>
                <ArrowUp size={12} strokeWidth={2} aria-hidden />
              </button>
              <button type="button" aria-label="next change" title="next change" disabled={identical} onClick={() => handle.current?.next()} className={cn(quiet, 'px-1.5')}>
                <ArrowDown size={12} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <button type="button" onClick={() => update({ stage: 'input' })} className={quiet}>
              edit input
            </button>
          </>
        )}
        <button type="button" onClick={clear} className={quiet}>
          clear
        </button>
      </div>

      {result ? (
        <>
          {identical && (
            <div className="flex flex-none items-center gap-2 border-b border-border-subtle px-3 py-2 text-[13px]">
              <Check size={14} strokeWidth={2} className="text-muted-foreground" aria-hidden />
              <span>The two texts are identical.</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                Edit either side and differences appear here as you type.{cmp.ignoreWhitespace && ' Whitespace differences are ignored.'}
              </span>
            </div>
          )}
          {unified ? (
            <div className="flex h-8 flex-none items-center gap-3 border-b border-border-subtle px-3 font-mono text-[11px] text-muted-foreground">
              <span className="text-diff-del">−</span>
              <span className="font-sans text-[13px] text-foreground">{sides.left.kind === 'doc' ? docOf(sides.left)?.title : 'pasted text'}</span>
              <span className="text-diff-add">+</span>
              <span className="font-sans text-[13px] text-foreground">{sides.right.kind === 'doc' ? docOf(sides.right)?.title : 'pasted text'}</span>
            </div>
          ) : (
            <div className="flex flex-none">
              <div className="min-w-0 flex-1 border-r border-border">{sideHeader('left')}</div>
              <div className="min-w-0 flex-1">{sideHeader('right')}</div>
            </div>
          )}
          <ResultEditors cmp={cmp} left={binding('left')} right={binding('right')} unified={unified} onCounts={setCounts} handle={handle} />
        </>
      ) : (
        <>
          <div className={cn('flex min-h-0 flex-auto', narrow ? 'flex-col' : 'flex-row')}>
            {inputSide('left')}
            <div className={narrow ? 'h-px flex-none bg-border' : 'w-px flex-none bg-border'} />
            {inputSide('right')}
          </div>
          <div className="flex flex-none items-center justify-center gap-3 border-t border-border px-3 py-3">
            <button
              type="button"
              disabled={!ready}
              onClick={find}
              className={cn(
                'flex h-7 items-center gap-2 rounded-md px-[13px] font-mono text-[12px]',
                ready ? 'bg-primary font-semibold text-primary-foreground hover:brightness-110' : 'border border-dashed border-border-strong text-ink-dim',
              )}
            >
              find difference <span className={ready ? 'opacity-70' : ''}>⌘↵</span>
            </button>
            {!ready && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {!hasText('left') && !hasText('right') ? 'Fill both sides to compare.' : `Fill the ${hasText('left') ? 'changed' : 'original'} side to compare.`}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
