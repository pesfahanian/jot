import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ModelChain } from '@/components/review/ModelChain'
import { db, type Provider } from '@/lib/db'
import { defaultSettings, providerKey, setProviderKey, updateSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { modelChain, PROVIDER_ORDER, PROVIDERS } from '@/review/providers'
import { useNow } from '@/state/hooks'
import { useReview } from '@/state/review'
import { Grid, Label, quietButton, SectionHead } from './controls'

// Settings → ai provider (round 4, frame 3a; was the AI Provider panel,
// 7a–7c). The provider reviews run on, its key, and its model chain; each
// provider keeps its own key and chain. No separate save: a key is stored
// only once a test passes, so "test" is the save. Rejected keys are never
// stored; a dropped connection never erases a key that already worked.
// Reached from settings, or by asking for a review with no key — then a
// passing test closes settings and starts that review (7b).

type Attempt = 'idle' | 'rejected' | 'offline'

function testedAgo(ts: number, now: number) {
  const m = Math.floor((now - ts) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function mask(key: string) {
  const prefix = key.match(/^sk-or-v\d+-/)?.[0] ?? key.slice(0, 6)
  return { prefix, tail: key.slice(-4) }
}

const strong = 'flex h-[26px] items-center rounded-md border border-ink-tertiary bg-hover-lift px-[9px] font-mono text-[11px] text-foreground hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function AiProviderSection({ onDone }: { onDone: () => void }) {
  const panel = useReview((s) => s.keyPanel)
  const testing = useReview((s) => s.keyTesting)
  const setTesting = useReview((s) => s.setKeyTesting)
  const run = useReview((s) => s.run)
  const settings = useLiveQuery(() => db.settings.get('settings'), []) ?? defaultSettings
  const now = useNow(15_000)
  const [draft, setDraft] = useState('')
  const [attempt, setAttempt] = useState<Attempt>('idle')
  const [show, setShow] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const provider = settings.provider ?? 'openrouter'
  const info = PROVIDERS[provider]
  const current = providerKey(settings, provider)
  const stored = current.key

  const pick = (p: Provider) => {
    if (p === provider || testing) return
    setDraft('')
    setAttempt('idle')
    setShow(false)
    void updateSettings({ provider: p })
  }

  // The field has focus on arrival, so pasting is the whole interaction (7b).
  useEffect(() => {
    if (!stored) input.current?.focus()
  }, [stored, provider])

  async function test(candidate: string) {
    setTesting(true)
    setAttempt('idle')
    const result = await info.testKey(candidate)
    setTesting(false)
    if (result.ok) {
      await setProviderKey(provider, { key: candidate, status: 'valid', lastValidatedAt: Date.now() })
      setDraft('')
      if (panel.open && panel.reason === 'review' && panel.documentId) {
        const { documentId, force } = panel
        onDone()
        void run(documentId, force)
      }
      return
    }
    if (result.reason === 'rejected') {
      setAttempt('rejected')
      if (candidate === stored) await setProviderKey(provider, { status: 'invalid' })
    } else {
      setAttempt('offline')
      if (candidate === stored) await setProviderKey(provider, { status: 'offline' })
    }
  }

  const clear = async () => {
    await setProviderKey(provider, { key: null, status: 'untested', lastValidatedAt: null })
    setDraft('')
    setAttempt('idle')
    setTimeout(() => input.current?.focus())
  }

  const candidate = stored ?? draft.trim()
  const rejected = attempt === 'rejected' || (stored && current.status === 'invalid' && attempt !== 'offline')
  const offline = attempt === 'offline' || (stored && current.status === 'offline' && attempt === 'idle')
  const dot = (cls: string) => <span className={cn('size-1.5 rounded-full', cls)} />

  let status
  if (testing) status = <>{dot('animate-pulse bg-primary')}testing</>
  else if (rejected) status = <>{dot('bg-destructive')}<span className="text-destructive">rejected</span> · {info.label} doesn't recognise this key</>
  else if (offline) status = <>{dot('bg-secondary-foreground')}no connection · key not checked</>
  else if (stored && current.status === 'valid') status = <>{dot('bg-primary')}key works{current.lastValidatedAt && ` · tested ${testedAgo(current.lastValidatedAt, now)}`}</>
  else if (stored) status = <>{dot('bg-ink-mute')}not tested yet</>
  else status = <>{dot('bg-ink-mute')}no key</>

  const m = stored ? mask(stored) : null
  const primaryLabel = offline ? 'retry' : stored && current.status === 'valid' && !rejected ? 'test again' : 'test'

  return (
    <>
      <SectionHead title="ai provider" id="settings-ai">
        Calls go straight from this browser to your provider, with your key. Nothing passes through jot.software.
      </SectionHead>
      {panel.open && panel.reason === 'review' && !stored && (
        <div className="text-[12.5px] leading-normal text-secondary-foreground">Style review runs on your own {info.label} key. Paste one to continue.</div>
      )}
      <Grid>
        <Label>provider</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={testing}
              aria-label={`provider: ${info.label}`}
              className="flex h-[26px] w-[220px] items-center justify-between rounded-md border border-border bg-background px-[9px] font-sans text-[12.5px] text-foreground hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-border-strong"
            >
              {info.label}
              <ChevronDown size={12} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
            {PROVIDER_ORDER.map((p) => (
              <DropdownMenuItem key={p} onSelect={() => pick(p)} className={cn(p === provider && 'text-foreground')}>
                <span className="flex-auto">{PROVIDERS[p].label}</span>
                {providerKey(settings, p).key && <span className="font-mono text-[10.5px] text-muted-foreground">key set</span>}
                <Check size={13} strokeWidth={2} className={cn('text-primary', p !== provider && 'invisible')} aria-hidden />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Label>key</Label>
        <span className="flex items-center gap-1.5">
          {stored && m ? (
            <span className={cn('flex h-[26px] min-w-0 flex-auto items-center gap-2 rounded-md border bg-inset pr-1 pl-[9px] text-[12px] text-foreground', rejected ? 'border-destructive' : 'border-border')}>
              <span className="min-w-0 flex-auto truncate tracking-[0.02em]">
                {show ? stored : (
                  <>
                    {m.prefix}
                    <span className="text-muted-foreground">{'•'.repeat(16)}</span>
                    {m.tail}
                  </>
                )}
              </span>
              <button type="button" onClick={() => setShow(!show)} className="rounded-sm px-1.5 text-[11px] text-secondary-foreground hover:text-foreground">
                {show ? 'hide' : 'show'}
              </button>
            </span>
          ) : (
            <input
              ref={input}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setAttempt('idle')
              }}
              onKeyDown={(e) => e.key === 'Enter' && draft.trim() && !testing && void test(draft.trim())}
              placeholder={info.placeholder}
              spellCheck={false}
              autoComplete="off"
              aria-label={`${info.label} API key`}
              className={cn(
                'h-[26px] min-w-0 flex-auto rounded-md border bg-inset px-[9px] text-[12px] text-foreground outline-none placeholder:text-ink-dim',
                attempt === 'rejected' ? 'border-destructive' : 'border-border focus:border-primary',
              )}
            />
          )}
          {candidate ? (
            <button type="button" disabled={testing} className={strong} onClick={() => void test(candidate)}>
              {primaryLabel}
            </button>
          ) : (
            <span className="flex h-[26px] items-center rounded-md border border-dashed border-border-strong px-[9px] text-ink-dim">test</span>
          )}
          {stored && (
            <button type="button" className={quietButton} onClick={() => void clear()}>
              clear
            </button>
          )}
        </span>
        <span />
        <span className="flex items-center gap-[7px] text-ink-tertiary">
          {status}
          {!stored && (
            <span className="ml-1">
              · get one at{' '}
              <a href={info.keysUrl} target="_blank" rel="noreferrer" className="text-secondary-foreground underline underline-offset-[3px] hover:text-foreground">
                {info.keysLabel}
              </a>
            </span>
          )}
        </span>
        <Label top>model chain</Label>
        <div className="font-sans text-[12.5px]">
          <ModelChain provider={provider} chain={modelChain(settings.models, provider)} custom={!!settings.models?.[provider]?.length} apiKey={stored && current.status !== 'invalid' ? stored : null} />
        </div>
      </Grid>
    </>
  )
}
