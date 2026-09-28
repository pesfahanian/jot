import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '@/lib/db'
import { defaultSettings, updateSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { testKey } from '@/review/openrouter'
import { useNow } from '@/state/hooks'
import { useReview } from '@/state/review'

// The OpenRouter key panel (7a–7c): a single-purpose popover anchored beside
// the sidebar's key row, built as one titled section with its own footer. Two doors
// open it — the key row, and clicking review with no key.
//
// No separate save: a key is stored only once a test passes, so "test" is
// the save. Rejected keys are never stored; a dropped connection never
// erases a key that already worked.

type Attempt = 'idle' | 'rejected' | 'offline'

const neutralButton =
  'flex h-6 items-center rounded-md border px-[11px] font-mono text-[11.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
// "test" / "test again" / "retry": strong-neutral, never the accent (§1.4).
const strong = cn(neutralButton, 'border-ink-tertiary bg-hover-lift text-foreground hover:border-foreground')
const quiet = cn(neutralButton, 'border-border-strong bg-popover text-secondary-foreground hover:text-foreground')

// "tested 2 min ago" (7a).
function testedAgo(ts: number, now: number) {
  const m = Math.floor((now - ts) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`
}

function mask(key: string) {
  const prefix = key.match(/^sk-or-v\d+-/)?.[0] ?? key.slice(0, 6)
  return { prefix, tail: key.slice(-4) }
}

// Mounted only while open, so its local field state resets on every open.
export function KeyPanel() {
  const open = useReview((s) => s.keyPanel.open)
  return open ? <KeyPanelBody /> : null
}

function KeyPanelBody() {
  const panel = useReview((s) => s.keyPanel)
  const close = useReview((s) => s.closeKeyPanel)
  const testing = useReview((s) => s.keyTesting)
  const setTesting = useReview((s) => s.setKeyTesting)
  const run = useReview((s) => s.run)
  const settings = useLiveQuery(() => db.settings.get('settings'), []) ?? defaultSettings
  const now = useNow(15_000)
  const [draft, setDraft] = useState('')
  const [attempt, setAttempt] = useState<Attempt>('idle')
  const [show, setShow] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const self = useRef<HTMLDivElement>(null)
  const stored = settings.openRouterApiKey

  // The field has focus on arrival, so pasting is the whole interaction (7b).
  useEffect(() => {
    if (!stored) input.current?.focus()
  }, [stored])

  // Closes on click-outside and Escape.
  useEffect(() => {
    if (!panel.open) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (self.current?.contains(t) || (t as Element).closest?.('[data-key-cell]')) return
      close()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key)
    }
  }, [panel.open, close])

  async function test(candidate: string) {
    setTesting(true)
    setAttempt('idle')
    const result = await testKey(candidate)
    setTesting(false)
    if (result.ok) {
      await updateSettings({ openRouterApiKey: candidate, keyStatus: 'valid', lastValidatedAt: Date.now() })
      setDraft('')
      // A passing test from the review door closes the panel and starts the
      // review that was clicked (7b).
      if (panel.reason === 'review' && panel.documentId) {
        close()
        void run(panel.documentId)
      }
      return
    }
    if (result.reason === 'rejected') {
      setAttempt('rejected')
      if (candidate === stored) await updateSettings({ keyStatus: 'invalid' })
    } else {
      setAttempt('offline')
      if (candidate === stored) await updateSettings({ keyStatus: 'offline' })
    }
  }

  const clear = async () => {
    await updateSettings({ openRouterApiKey: null, keyStatus: 'untested', lastValidatedAt: null })
    setDraft('')
    setAttempt('idle')
    setTimeout(() => input.current?.focus())
  }

  const candidate = stored ?? draft.trim()
  const rejected = attempt === 'rejected' || (stored && settings.keyStatus === 'invalid' && attempt !== 'offline')
  const offline = attempt === 'offline' || (stored && settings.keyStatus === 'offline' && attempt === 'idle')

  let status
  if (testing) {
    status = (
      <>
        <span className="flex h-[3px] w-5 overflow-hidden rounded-full bg-ink-mute">
          <span className="w-[45%] animate-pulse rounded-full bg-primary" />
        </span>
        <span>testing</span>
      </>
    )
  } else if (rejected) {
    status = (
      <>
        <span className="size-[5px] rounded-[2px] bg-destructive" />
        <span className="text-destructive">rejected</span>
        <span className="text-secondary-foreground">OpenRouter doesn't recognise this key</span>
      </>
    )
  } else if (offline) {
    status = (
      <>
        <span className="block size-[7px] rounded-[2px] border-[1.5px] border-secondary-foreground" />
        <span>no connection</span>
        <span className="text-muted-foreground">key not checked</span>
      </>
    )
  } else if (stored && settings.keyStatus === 'valid') {
    status = (
      <>
        <span className="size-[5px] rounded-[2px] bg-primary" />
        <span>valid</span>
        {settings.lastValidatedAt && <span className="text-muted-foreground">tested {testedAgo(settings.lastValidatedAt, now)}</span>}
      </>
    )
  } else if (stored) {
    status = (
      <>
        <span className="size-[5px] rounded-[2px] bg-ink-mute" />
        <span className="text-muted-foreground">not tested yet</span>
      </>
    )
  } else {
    status = (
      <>
        <span className="size-[5px] rounded-[2px] bg-ink-mute" />
        <span className="text-muted-foreground">no key</span>
      </>
    )
  }

  const m = stored ? mask(stored) : null
  const primaryLabel = offline ? 'retry' : stored && settings.keyStatus === 'valid' && !rejected ? 'test again' : 'test'

  return (
    <div
      ref={self}
      role="dialog"
      aria-label="OpenRouter key"
      className="absolute bottom-0 left-[calc(100%+var(--seam))] z-50 flex w-[380px] flex-col overflow-hidden rounded-(--radius-panel) border border-border-float bg-popover text-popover-foreground"
    >
      <div className={cn('flex items-center gap-2.5 pt-3 pr-3 pl-4', stored ? 'pb-2.5' : 'pb-1.5')}>
        <span className="flex-auto text-[15px] font-semibold tracking-[-0.02em]">OpenRouter key</span>
        <button type="button" aria-label="close" onClick={close} className="font-mono text-[13px] text-muted-foreground hover:text-foreground">
          ×
        </button>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pb-3.5">
        {!stored && panel.reason === 'review' && (
          <div className="text-[12.5px] leading-[1.55] text-secondary-foreground">Style review runs on your own OpenRouter key. Paste one to continue.</div>
        )}
        {stored && m ? (
          <div
            className={cn(
              'flex h-8 items-center gap-2 rounded-md border bg-background pr-1.5 pl-2.5 font-mono text-[12.5px]',
              rejected ? 'border-destructive' : 'border-border',
            )}
          >
            <span className="min-w-0 flex-auto truncate tracking-[0.02em]">
              {show ? (
                stored
              ) : (
                <>
                  {m.prefix}
                  <span className="text-muted-foreground">{'•'.repeat(16)}</span>
                  {m.tail}
                </>
              )}
            </span>
            <button type="button" onClick={() => setShow(!show)} className="rounded-sm px-1.5 py-0.5 text-[11px] text-secondary-foreground hover:text-foreground">
              {show ? 'hide' : 'show'}
            </button>
          </div>
        ) : (
          <input
            ref={input}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setAttempt('idle')
            }}
            onKeyDown={(e) => e.key === 'Enter' && draft.trim() && !testing && void test(draft.trim())}
            placeholder="sk-or-v1-…"
            spellCheck={false}
            autoComplete="off"
            aria-label="OpenRouter API key"
            className={cn(
              'h-8 rounded-md border bg-background px-2.5 font-mono text-[12.5px] text-foreground outline-none placeholder:text-ink-dim',
              attempt === 'rejected' ? 'border-destructive' : 'border-border focus:border-primary',
            )}
          />
        )}
        <div className="flex items-center gap-2 font-mono text-[11.5px]">{status}</div>
        <div className="flex items-center gap-1.5 pt-0.5">
          {candidate ? (
            <button type="button" disabled={testing} className={strong} onClick={() => void test(candidate)}>
              {primaryLabel}
            </button>
          ) : (
            // Disabled until something is in the field — the dashed register.
            <span className="flex h-6 items-center rounded-md border border-dashed border-border-strong px-[11px] font-mono text-[11.5px] text-ink-dim">
              test
            </span>
          )}
          {stored ? (
            <button type="button" className={quiet} onClick={() => void clear()}>
              clear
            </button>
          ) : (
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">
              get one at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-secondary-foreground underline underline-offset-[3px] hover:text-foreground">
                openrouter.ai/keys
              </a>
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-border px-4 pt-2.5 pb-3 text-[12px] leading-[1.55] text-muted-foreground">
        Stored in this browser only. Sent only to openrouter.ai, and only when you run a review.
      </div>
    </div>
  )
}
