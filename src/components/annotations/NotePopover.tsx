import { useEffect, useRef } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { aiNotesInOrder, notesInOrder } from '@/lib/annotations'
import { relativeTime } from '@/lib/docList'
import { cn } from '@/lib/utils'
import { activeEditor } from '@/editor/annotations'
import { useAnnotations } from '@/state/annotations'
import { useNow } from '@/state/hooks'
import { useOverlays } from '@/state/overlays'

// A personal note, read and edited in a popover under its text (round 4,
// frame 7) — not in a margin: panes go down to 260px. Edits save as you
// type; "done" only closes. A new note left empty goes when it closes.

const NONE: never[] = []
const button = 'flex h-[22px] items-center rounded-md border border-border bg-background px-[7px] font-mono text-[11px] text-secondary-foreground hover:text-foreground'

export function NotePopover() {
  const open = useOverlays((s) => s.note)
  const set = useOverlays((s) => s.set)
  const list = useAnnotations((s) => (open ? s.byDoc[open.documentId] : undefined)) ?? NONE
  const now = useNow()
  const area = useRef<HTMLTextAreaElement>(null)
  // A personal note, or an AI note (an instruction for AI mode's next
  // message, numbered as it is in the queue).
  const isAi = !!open && list.find((a) => a.id === open.id)?.kind === 'ai-note'
  const notes = isAi ? aiNotesInOrder(list) : notesInOrder(list)
  const index = open ? notes.findIndex((n) => n.id === open.id) : -1
  const note = notes[index]

  // The open note's text keeps a quiet wash while the popover is up.
  useEffect(() => {
    const el = open && document.querySelector(`.jot-note[data-note="${open.id}"]`)
    el?.classList.add('jot-note-open')
    return () => el?.classList.remove('jot-note-open')
  }, [open])
  useEffect(() => {
    if (open?.editing) area.current?.focus()
  }, [open?.editing, open?.id])

  if (!open || !note) return null
  const update = (patch: { body?: string }) => {
    useAnnotations.getState().set(
      open.documentId,
      list.map((a) => (a.id === note.id ? { ...a, ...patch, updatedAt: Date.now() } : a)),
    )
  }
  const remove = () => {
    useAnnotations.getState().set(
      open.documentId,
      list.filter((a) => a.id !== note.id),
    )
    set({ note: null })
  }
  const close = () => {
    if (!note.body?.trim()) return remove()
    set({ note: null })
    activeEditor()?.view.focus()
  }

  return (
    <Popover open onOpenChange={(o) => !o && close()}>
      <PopoverAnchor asChild>
        <span aria-hidden className="pointer-events-none fixed h-0" style={{ left: open.anchor.left, top: open.anchor.bottom, width: 1 }} />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="flex w-[280px] flex-col p-0"
        onOpenAutoFocus={(e) => {
          // Writing a new note starts in its box; reading one leaves focus
          // where it was.
          e.preventDefault()
          if (open.editing) area.current?.focus()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }}
      >
        <div className="flex items-center gap-2 px-3 pt-[9px] font-mono text-[11px] text-muted-foreground">
          {isAi ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-document">{index + 1}</span>
          ) : (
            <span className="size-[7px] rounded-[1px] bg-secondary-foreground" />
          )}
          <span className="flex-auto">{isAi ? (open.editing ? 'ai note · instruction' : 'ai note · goes with your next message') : open.editing ? 'note · editing' : `note · ${relativeTime(note.updatedAt, now)}`}</span>
          <span>{open.editing ? (note.body ? 'saved' : '') : isAi ? '' : `${index + 1} of ${notes.length}`}</span>
        </div>
        {open.editing ? (
          <div className="flex flex-col gap-2 px-3 pt-2 pb-2.5">
            <textarea
              ref={area}
              autoFocus
              dir="auto"
              value={note.body ?? ''}
              onChange={(e) => update({ body: e.target.value })}
              rows={4}
              placeholder={isAi ? 'what should change here?' : 'write a note'}
              aria-label="note"
              className="min-h-[76px] resize-none rounded-md border border-primary bg-inset px-[9px] py-[7px] text-[13px] leading-normal text-foreground outline-none placeholder:text-ink-dim"
            />
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <button type="button" onClick={remove} className="flex h-[22px] items-center rounded-md px-[7px] text-destructive hover:bg-hover-lift">
                delete note
              </button>
              <span className="flex-auto" />
              <button type="button" onClick={close} className="flex h-[22px] items-center rounded-md border border-foreground bg-foreground px-[7px] text-document">
                done
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              dir="auto"
              onClick={() => set({ note: { ...open, editing: true } })}
              className="px-3 pt-[7px] pb-2.5 text-left text-[13px] leading-normal text-pretty whitespace-pre-wrap"
            >
              {note.body}
            </button>
            <div className="flex items-center gap-1.5 border-t border-border-subtle px-3 py-2 font-mono text-[11px] text-secondary-foreground">
              <span className={cn('flex-auto text-muted-foreground', !note.quote && 'text-flag-check')}>{note.quote ? 'click to edit' : 'its text was deleted'}</span>
              <button type="button" className={button} onClick={() => set({ note: { ...open, editing: true } })}>
                edit
              </button>
              <button type="button" className={button} onClick={remove}>
                delete
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
