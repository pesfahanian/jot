import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { commitDraft } from '@/state/actions'
import { draftFieldInSidebar, useWorkspace } from '@/state/workspace'

// A new document before it exists (workspace.draft): a name field — in the
// sidebar, or in the draft's tab while the sidebar is hidden or AI mode has
// its place — and an empty page in the pane. ↩ creates it with the name
// typed (untitled when empty); a click into the page creates it untitled;
// esc, or focus going anywhere else, drops it.

export function DraftNameField({ className }: { className?: string }) {
  const nonce = useWorkspace((s) => s.draft?.nonce)
  const cancelDraft = useWorkspace((s) => s.cancelDraft)
  const [value, setValue] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  // Asked again while open (the + pressed twice): back into the field.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' })
    ref.current?.focus()
  }, [nonce])
  return (
    <input
      ref={ref}
      value={value}
      aria-label="new document name"
      placeholder="name the document"
      data-rename-field=""
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        // preventDefault: focus moves to the editor inside this handler, and
        // the Enter would otherwise land there as a newline.
        if (e.key === 'Enter') {
          e.preventDefault()
          done.current = true
          void commitDraft(value)
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          done.current = true
          cancelDraft()
        }
      }}
      // The page's mousedown keeps focus here (DraftPage), so a blur is
      // focus going somewhere else.
      onBlur={() => !done.current && cancelDraft()}
      className={cn('-my-px min-w-0 flex-auto rounded-sm border border-primary bg-document px-1 text-[13px] text-foreground outline-none placeholder:text-ink-dim', className)}
    />
  )
}

// The draft's row at the top of the sidebar's list.
export function DraftRow() {
  return (
    <div className="flex items-center gap-2 border-l-2 border-primary bg-popover py-[5px] pr-3 pl-2.5">
      <span className="size-2 flex-none" />
      <span className="w-[7px] flex-none" />
      <DraftNameField />
    </div>
  )
}

// The draft's tab: the name field itself when the sidebar can't hold it.
export function DraftTab({ focused }: { focused: boolean }) {
  const inSidebar = useWorkspace(draftFieldInSidebar)
  const cancelDraft = useWorkspace((s) => s.cancelDraft)
  return (
    <div
      role="tab"
      aria-selected
      data-tab-id="draft"
      className={cn('-mb-px flex w-[200px] flex-none items-center gap-2.5 border-r border-b-2 border-border bg-document px-3.5 text-foreground', focused ? 'border-b-primary' : 'border-b-ink-dim')}
    >
      {inSidebar ? <span className="flex-auto truncate text-[13px] text-muted-foreground">new document</span> : <DraftNameField />}
      <button
        type="button"
        aria-label="cancel the new document"
        // Before the field's blur, which would cancel it anyway.
        onMouseDown={(e) => {
          e.preventDefault()
          cancelDraft()
        }}
        className="flex-none font-mono text-[13px] text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
    </div>
  )
}

// The empty page: a click here creates the document untitled and puts the
// cursor in it.
export function DraftPage() {
  return (
    <div
      className="flex-auto cursor-text"
      onMouseDown={(e) => {
        e.preventDefault()
        void commitDraft()
      }}
    />
  )
}
