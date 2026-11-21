import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { getSettings } from '@/lib/settings'
import { languageName, translate } from '@/lib/translate'
import { viewsOf } from '@/editor/sessions'
import { translationPlan, translationPrefs } from '@/state/annotate'
import { useOverlays } from '@/state/overlays'
import { useUi } from '@/state/ui'
import { LanguagePicker } from './LanguagePicker'

// Translating a selection (round 4, frame 8): Google Cloud Translation, no
// AI. The original and its translation; copy it, or replace the selection
// with it — a separate, explicit action. Where it goes is set in settings →
// translation (Farsi into English, anything else into Farsi, unless
// changed: state/annotate.ts translationPlan); both ends can be changed
// here, from Google's whole list.

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
  const settings = useLiveQuery(() => getSettings(), [])
  const key = settings === undefined ? undefined : (settings.translateKey?.key ?? null)
  const prefs = translationPrefs(settings ?? {})
  const recent = settings?.translateRecent ?? []
  const plan = translationPlan(open.text, prefs)
  // What the person picked here, over the plan.
  const [picked, setPicked] = useState<{ source?: string | null; target?: string }>({})
  const source = picked.source !== undefined ? picked.source : plan.source
  const target = picked.target ?? plan.target
  const asked = `${source ?? ''}>${target}`
  const [answer, setAnswer] = useState<Result | null>(null)
  // An answer counts only for what it was asked for.
  const result = answer && answer.for === asked ? answer : { state: 'working' as const }
  const openSettings = useUi((s) => s.openSettings)

  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    translate(open.text, target, key, ctrl.signal, source)
      .then((r) => {
        // Already in the language it was sent to: into the other one instead.
        if (r.ok && r.from === target && picked.target === undefined && target !== prefs.back) return setPicked((p) => ({ ...p, target: prefs.back }))
        setAnswer(
          r.ok
            ? { for: asked, state: 'done', text: r.text, from: r.from }
            : { for: asked, state: 'error', message: r.reason === 'offline' ? 'No connection.' : r.reason === 'rejected' ? `Google didn't accept the key${r.message ? `: ${r.message}` : '.'}` : (r.message ?? 'Google answered with an error.') },
        )
      })
      .catch(() => {})
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, asked, open.text])

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
  // The source as Google detected it, once it answers.
  const shownSource = source ?? (result.state === 'done' && result.from ? result.from : plan.shown)

  return (
    <Popover open onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor asChild>
        <span aria-hidden className="pointer-events-none fixed h-0" style={{ left: open.anchor.left, top: open.anchor.bottom, width: 1 }} />
      </PopoverAnchor>
      <PopoverContent align="start" sideOffset={6} className="flex w-[330px] flex-col p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 font-mono text-[11px] text-ink-tertiary">
          <span className="flex-auto font-sans text-[12.5px] font-semibold text-foreground">translate</span>
          <LanguagePicker label="translate from" value={source} shown={languageName(shownSource)} detect recent={recent} onChange={(c) => setPicked((p) => ({ ...p, source: c }))} />
          <span>→</span>
          <LanguagePicker label="translate into" value={target} recent={recent} onChange={(c) => c && setPicked((p) => ({ ...p, target: c }))} />
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
