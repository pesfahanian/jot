import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { getSettings } from '@/lib/settings'
import { LANGUAGES, translate } from '@/lib/translate'
import { viewsOf } from '@/editor/sessions'
import { translationTarget } from '@/state/annotate'
import { useOverlays } from '@/state/overlays'
import { useUi } from '@/state/ui'

// Translating a selection (round 4, frame 8): Google Cloud Translation, no
// AI. The original and its translation; copy it, or replace the selection
// with it — a separate, explicit action. Farsi goes into English, anything
// else into Farsi, and the target can be changed.

const button = 'flex h-[22px] flex-none items-center whitespace-nowrap rounded-md border border-border bg-background px-[7px] font-mono text-[11px] text-secondary-foreground hover:text-foreground'
const strong = 'flex h-[22px] flex-none items-center whitespace-nowrap rounded-md border border-foreground bg-foreground px-[7px] font-mono text-[11px] text-document disabled:opacity-50'

export function TranslatePopover() {
  const open = useOverlays((s) => s.translate)
  const set = useOverlays((s) => s.set)
  return open ? <TranslateBody key={`${open.documentId}:${open.from}:${open.to}`} open={open} onClose={() => set({ translate: null })} /> : null
}

type Open = NonNullable<ReturnType<typeof useOverlays.getState>['translate']>
type Result = ({ state: 'done'; text: string; from: string } | { state: 'error'; message: string }) & { for: string }

function TranslateBody({ open, onClose }: { open: Open; onClose: () => void }) {
  const key = useLiveQuery(() => getSettings().then((s) => s.translateKey?.key ?? null), [])
  const [target, setTarget] = useState(() => translationTarget(open.text))
  const [answer, setAnswer] = useState<Result | null>(null)
  // An answer counts only for the target it was asked for.
  const result = answer && answer.for === target ? answer : { state: 'working' as const }
  const openSettings = useUi((s) => s.openSettings)

  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    translate(open.text, target, key, ctrl.signal)
      .then((r) =>
        setAnswer(
          r.ok
            ? { for: target, state: 'done', text: r.text, from: r.from }
            : { for: target, state: 'error', message: r.reason === 'offline' ? 'No connection.' : r.reason === 'rejected' ? `Google didn't accept the key${r.message ? `: ${r.message}` : '.'}` : (r.message ?? 'Google answered with an error.') },
        ),
      )
      .catch(() => {})
    return () => ctrl.abort()
  }, [key, target, open.text])

  const replace = () => {
    if (result.state !== 'done') return
    const view = viewsOf(open.documentId)[0]
    // Only if the selected text is still what was translated.
    if (view && view.state.sliceDoc(open.from, open.to) === open.text) {
      view.dispatch({ changes: { from: open.from, to: open.to, insert: result.text }, selection: { anchor: open.from + result.text.length }, userEvent: 'input.translate' })
      view.focus()
    }
    onClose()
  }
  const from = result.state === 'done' && result.from ? result.from : translationTarget(open.text) === 'en' ? 'fa' : 'en'

  return (
    <Popover open onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor asChild>
        <span aria-hidden className="pointer-events-none fixed h-0" style={{ left: open.anchor.left, top: open.anchor.bottom, width: 1 }} />
      </PopoverAnchor>
      <PopoverContent align="start" sideOffset={6} className="flex w-[330px] flex-col p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 font-mono text-[11px] text-ink-tertiary">
          <span className="flex-auto font-sans text-[12.5px] font-semibold text-foreground">translate</span>
          <span>{LANGUAGES[from] ?? from}</span>
          <span>→</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-5 items-center gap-1 rounded-[5px] border border-border bg-background px-1.5 text-secondary-foreground hover:text-foreground">
                {LANGUAGES[target] ?? target}
                <ChevronDown size={11} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <DropdownMenuItem key={code} onSelect={() => setTarget(code)}>
                  {name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {key === null ? (
          <div className="flex flex-col gap-2.5 px-3 pt-2.5 pb-3">
            <div className="text-[13px] leading-normal text-pretty">Translating a selection needs a Google Cloud Translation key. It's separate from your AI key, and no AI is involved.</div>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="min-w-0 flex-auto truncate text-muted-foreground">settings → translation</span>
              <button type="button" className={button} onClick={onClose}>
                cancel
              </button>
              <button
                type="button"
                className={strong}
                onClick={() => {
                  onClose()
                  openSettings('translation')
                }}
              >
                open settings
              </button>
            </div>
          </div>
        ) : (
          <>
            <div dir="auto" className="line-clamp-4 px-3 pt-[9px] text-[12.5px] leading-[1.55] text-ink-tertiary">
              {open.text}
            </div>
            <div dir="auto" className="max-h-[240px] overflow-y-auto px-3 pt-1.5 pb-[11px] text-[14px] leading-[1.7] whitespace-pre-wrap">
              {result.state === 'done' ? result.text : result.state === 'error' ? <span className="text-[13px] text-destructive">{result.message}</span> : <span className="text-ink-dim">translating…</span>}
            </div>
            <div className="flex items-center gap-1.5 border-t border-border-subtle px-3 py-2 font-mono text-[11px] text-secondary-foreground">
              <span className="min-w-0 flex-auto truncate text-muted-foreground">google translate · no ai</span>
              <button type="button" className={button} disabled={result.state !== 'done'} onClick={() => result.state === 'done' && void navigator.clipboard?.writeText(result.text)}>
                copy
              </button>
              <button type="button" className={strong} disabled={result.state !== 'done'} onClick={replace}>
                replace selection
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
