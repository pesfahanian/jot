import { EditorView } from '@codemirror/view'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { notesInOrder } from '@/lib/annotations'
import { cn } from '@/lib/utils'
import { anchorOf } from '@/editor/annotations'
import { viewsOf } from '@/editor/sessions'
import { useAnnotations } from '@/state/annotations'
import { useOverlays } from '@/state/overlays'

// "notes N" in the status bar (round 4, frame 7c): every note in the
// document, in document order; pick one to go to it and read it.

const NONE: never[] = []

export function NotesCell({ documentId }: { documentId: string }) {
  const list = useAnnotations((s) => s.byDoc[documentId]) ?? NONE
  const open = useOverlays((s) => s.notesList)
  const set = useOverlays((s) => s.set)
  const notes = notesInOrder(list)
  if (!notes.length) return null
  const view = viewsOf(documentId)[0]

  const go = (id: string, at: number) => {
    set({ notesList: false })
    if (!view) return
    view.dispatch({ selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: 'center' }) })
    view.focus()
    // Once scrolled into view, the note's text is on screen to hang from.
    requestAnimationFrame(() => {
      const el = view.contentDOM.querySelector(`[data-note="${id}"]`)
      const coords = view.coordsAtPos(at)
      const anchor = el ? anchorOf(el) : coords && { left: coords.left, top: coords.top, bottom: coords.bottom }
      if (anchor) set({ note: { documentId, id, anchor, editing: false } })
    })
  }

  return (
    <Popover open={open} onOpenChange={(o) => set({ notesList: o })}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'my-1 flex items-center rounded-[5px] border px-[7px] text-muted-foreground hover:text-foreground',
            open ? 'border-border-strong bg-hover-lift' : 'border-transparent',
          )}
        >
          notes <span className="pl-1.5 text-foreground">{notes.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="flex max-h-[420px] w-[330px] flex-col overflow-hidden p-0 text-[12.5px]">
        <div className="flex items-center border-b border-border-subtle px-3 py-2">
          <span className="flex-auto font-semibold">notes</span>
          <span className="font-mono text-[11px] text-muted-foreground">{notes.length} · in document order</span>
        </div>
        <div className="overflow-y-auto">
          {notes.map((n) => {
            const line = view ? view.state.doc.lineAt(Math.min(n.from, view.state.doc.length)).number : null
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id, n.from)}
                className="grid w-full grid-cols-[22px_minmax(0,1fr)] gap-x-2 gap-y-0.5 border-b border-border-subtle px-3 py-[7px] text-left last:border-b-0 hover:bg-hover-lift"
              >
                <span className="font-mono text-[11px] text-ink-tertiary">{line ?? ''}</span>
                <span dir="auto" className="truncate font-mono text-[11px] text-ink-tertiary">
                  {n.quote || '(text deleted)'}
                </span>
                <span />
                <span dir="auto" className="line-clamp-2">
                  {n.body || <span className="text-ink-dim">empty note</span>}
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
