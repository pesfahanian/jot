import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getSettings, updateSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { applyTypo, fixAllTypos, typoMenuView, typosOf } from '@/editor/spelling'
import { useOverlays } from '@/state/overlays'

// The right-click menu on a marked typo (editor/spelling.ts): its fixes,
// best guess first; fix every sure one in the document; or ignore the word
// from now on — in every document (settings keeps the list).

async function ignore(word: string) {
  const list = (await getSettings()).spellIgnore ?? []
  const w = word.toLowerCase()
  if (!list.includes(w)) await updateSettings({ spellIgnore: [...list, w] })
}

export function TypoMenu() {
  const open = useOverlays((s) => s.typo)
  const set = useOverlays((s) => s.set)
  const view = typoMenuView()
  if (!open || !view) return null
  const { typo } = open
  const sure = typosOf(view).filter((t) => t.sure).length
  return (
    <DropdownMenu open onOpenChange={(o) => !o && set({ typo: null })} modal={false}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="pointer-events-none fixed size-0" style={{ left: open.x, top: open.y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={2}
        className="w-[228px] text-[12.5px] [direction:ltr]"
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          view.focus()
        }}
      >
        {/* The guesses in order, the best (a click's) first, as the
            browser lists them. */}
        {[typo.fix, ...typo.others].map((fix, i) => (
          <DropdownMenuItem key={fix} onSelect={() => applyTypo(view, typo, fix)}>
            <span className={cn('flex-auto', i === 0 && 'font-medium')}>{fix}</span>
            {i === 0 && <span className="font-mono text-[11px] text-muted-foreground">click</span>}
          </DropdownMenuItem>
        ))}
        {sure > (typo.sure ? 1 : 0) && (
          <DropdownMenuItem onSelect={() => fixAllTypos(view)}>
            <span className="flex-auto">fix all sure ones</span>
            <span className="font-mono text-[11px] text-muted-foreground">{sure}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void ignore(typo.word)}>
          <span className="flex-auto truncate">
            ignore <span className="text-muted-foreground">“{typo.word}”</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
