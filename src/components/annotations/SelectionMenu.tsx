import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { covers } from '@/lib/annotations'
import { formatKey } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import { activeEditor } from '@/editor/annotations'
import { useAnnotations } from '@/state/annotations'
import { addAiNote, addNote, highlightSelection, inAiModeOn, translateSelection, translationTarget, underlineSelection } from '@/state/annotate'
import { keysOf } from '@/state/commands'
import { useOverlays } from '@/state/overlays'

// The right-click menu on selected text (round 4, frame 5): Jot's own,
// replacing the browser's there. Stays English and left-to-right on Farsi
// text. The highlight row applies the last colour used; its swatches pick
// one. A row whose mark already covers the selection takes it off.

const key = (id: string) => {
  const k = keysOf(id)[0]
  return k ? <span className="font-mono text-[11px] text-muted-foreground">{formatKey(k)}</span> : null
}
const SWATCH = { 1: 'bg-[var(--hl-1)]', 2: 'bg-[var(--hl-2)]', 3: 'bg-[var(--hl-3)]' } as const
const NONE: never[] = []

export function SelectionMenu() {
  const menu = useOverlays((s) => s.menu)
  const lastColor = useOverlays((s) => s.lastColor)
  const set = useOverlays((s) => s.set)
  const list = useAnnotations((s) => (menu ? s.byDoc[menu.documentId] : undefined)) ?? NONE
  if (!menu) return null
  const ed = activeEditor()
  const text = ed?.view.state.sliceDoc(menu.from, menu.to) ?? ''
  const highlighted = covers(list, 'highlight', menu.from, menu.to, lastColor)
  const underlined = covers(list, 'underline', menu.from, menu.to)
  const target = translationTarget(text)
  const mod = formatKey('Mod-x').slice(0, -1)

  // Cut and copy write the clipboard; paste reads it and replaces the
  // selection, as one edit.
  const clip = async (what: 'cut' | 'copy' | 'paste') => {
    if (!ed) return
    ed.view.focus()
    if (what === 'paste') {
      const t = await navigator.clipboard?.readText?.().catch(() => null)
      if (t != null) ed.view.dispatch(ed.view.state.replaceSelection(t), { userEvent: 'input.paste' })
      return
    }
    await navigator.clipboard?.writeText(text).catch(() => document.execCommand(what))
    if (what === 'cut') ed.view.dispatch({ changes: { from: menu.from, to: menu.to }, userEvent: 'delete.cut' })
  }

  return (
    <DropdownMenu open onOpenChange={(o) => !o && set({ menu: null })} modal={false}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="pointer-events-none fixed size-0" style={{ left: menu.x, top: menu.y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={2}
        className="w-[228px] text-[12.5px] [direction:ltr]"
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          ed?.view.focus()
        }}
      >
        <DropdownMenuItem onSelect={() => void clip('cut')}>
          <span className="flex-auto">cut</span>
          <span className="font-mono text-[11px] text-muted-foreground">{mod}X</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void clip('copy')}>
          <span className="flex-auto">copy</span>
          <span className="font-mono text-[11px] text-muted-foreground">{mod}C</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void clip('paste')}>
          <span className="flex-auto">paste</span>
          <span className="font-mono text-[11px] text-muted-foreground">{mod}V</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => highlightSelection()} className="gap-[5px]">
          <span className="flex-auto">{highlighted ? 'remove highlight' : 'highlight'}</span>
          {([1, 2, 3] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`highlight colour ${c}`}
              onClick={(e) => {
                e.stopPropagation()
                highlightSelection(c)
              }}
              className={cn('size-3.5 rounded-[3px] border', SWATCH[c], c === lastColor ? 'border-ink-tertiary' : 'border-border')}
            />
          ))}
          <span className="pl-1">{key('highlight')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => underlineSelection()}>
          <span className="flex-auto">{underlined ? 'remove underline' : 'underline'}</span>
          {key('underline')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => addNote()}>
          <span className="flex-auto">add note</span>
          {key('addNote')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => translateSelection()}>
          <span className="flex-auto">translate</span>
          <span className="pr-2 font-mono text-[11px] text-ink-tertiary">{target === 'fa' ? 'en → fa' : 'fa → en'}</span>
          {key('translate')}
        </DropdownMenuItem>
        {/* In AI mode: an instruction for the AI, queued for the next
            message, numbered as it will be in the chat. */}
        {inAiModeOn(menu.documentId) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void addAiNote()} className="gap-2">
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[10px] font-semibold text-document">{list.filter((a) => a.kind === 'ai-note').length + 1}</span>
              <span className="flex-auto">add ai note</span>
              {key('addAiNote')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
