import type { ReactNode } from 'react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import type { JotDocument, TagColor } from '@/lib/db'
import { TAG_SLOTS } from '@/lib/docList'
import { cn } from '@/lib/utils'
import { deleteWithUndo, setColor, setPinned } from '@/state/actions'
import { useWorkspace } from '@/state/workspace'
import { NoColorMark, PinIcon } from './icons'
import { tagClass } from './tagClass'

// A document's own context menu (3c) — right-click on its sidebar row or its
// tab. Colors sit at the top in the fixed slot order, "no color" as a seventh
// slot; the assigned one is ringed. Assigning replaces (ADR-007).
export function DocumentMenu({ doc, children }: { doc: JotDocument; children: ReactNode }) {
  const setRenaming = useWorkspace((s) => s.setRenaming)
  const slot = (color: TagColor | null) => {
    const selected = doc.color === color
    return (
      <ContextMenuItem
        key={color ?? 'none'}
        title={color ? `color ${color}` : 'no color'}
        onSelect={() => void setColor(doc.id, color)}
        className={cn(
          'size-5 justify-center rounded-md border p-0',
          selected ? 'border-foreground' : 'border-transparent',
        )}
      >
        {color ? <span className={cn('size-3.5 rounded-sm', tagClass(color))} /> : <NoColorMark className="size-3.5" />}
      </ContextMenuItem>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-[196px]"
        // Closing hands focus back to the row (the menu holds it until then,
        // so the name field can't take it earlier). After "rename" it goes to
        // the name field instead, whole name selected, so typing replaces it.
        onCloseAutoFocus={(e) => {
          if (useWorkspace.getState().renamingId !== doc.id) return
          e.preventDefault()
          const field = document.querySelector<HTMLInputElement>('input[data-rename-field]')
          field?.focus()
          field?.select()
        }}
      >
        <div className="flex items-center gap-[5px] px-1.5 pt-1 pb-1.5">
          {TAG_SLOTS.map(slot)}
          {slot(null)}
        </div>
        <div className="-mx-1 mb-1 h-px bg-border-subtle" />
        <ContextMenuItem onSelect={() => setRenaming(doc.id)}>
          <span className="flex w-3.5 justify-center">
            <span className="block h-[1.5px] w-[11px] bg-current" />
          </span>
          rename
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void setPinned(doc.id, !doc.pinned)}>
          <span className="flex w-3.5 justify-center">
            <PinIcon />
          </span>
          {doc.pinned ? 'unpin' : 'pin'}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void deleteWithUndo(doc)}>
          <span className="flex w-3.5 justify-center font-mono text-[13px] text-ink-tertiary">×</span>
          delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
