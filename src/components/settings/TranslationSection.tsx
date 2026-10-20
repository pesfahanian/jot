import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { getSettings, updateSettings } from '@/lib/settings'
import { testTranslateKey } from '@/lib/translate'
import { cn } from '@/lib/utils'
import { Grid, Label, quietButton, SectionHead } from './controls'

// Settings → translation (round 4, frame 3a): a Google Cloud Translation
// key, used only to translate a selection — separate from the AI provider,
// and no AI involved. Stored once a test passes, like the AI keys.

const strong = 'flex h-[26px] items-center rounded-md border border-ink-tertiary bg-hover-lift px-[9px] font-mono text-[11px] text-foreground hover:border-foreground'

export function TranslationSection() {
  const current = useLiveQuery(() => getSettings().then((s) => s.translateKey ?? null), [])
  const [draft, setDraft] = useState('')
  const [state, setState] = useState<{ testing: boolean; error: string | null }>({ testing: false, error: null })
  const stored = current?.key ?? null

  const test = async (candidate: string) => {
    setState({ testing: true, error: null })
    const r = await testTranslateKey(candidate)
    if (r.ok) {
      await updateSettings({ translateKey: { key: candidate, status: 'valid', lastValidatedAt: Date.now() } })
      setDraft('')
      setState({ testing: false, error: null })
    } else {
      setState({ testing: false, error: r.reason === 'offline' ? 'no connection · key not checked' : r.reason === 'rejected' ? `rejected${r.message ? ` · ${r.message}` : ''}` : (r.message ?? 'Google answered with an error') })
    }
  }

  return (
    <>
      <SectionHead title="translation" id="settings-translation">
        A Google Cloud Translation key, used only to translate a selection. Separate from the AI provider; no AI is involved. It needs a Google Cloud project with the Cloud Translation API turned on and billing set up — the first 500,000 characters a month are free. Restrict the key to this site and that one API.
      </SectionHead>
      <Grid>
        <Label>key</Label>
        <span className="flex items-center gap-1.5">
          {stored ? (
            <span className="flex h-[26px] min-w-0 flex-auto items-center rounded-md border border-border bg-inset px-[9px] text-[12px]">
              {stored.slice(0, 6)}
              <span className="text-muted-foreground">{'•'.repeat(16)}</span>
              {stored.slice(-4)}
            </span>
          ) : (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && draft.trim() && void test(draft.trim())}
              placeholder="paste a key"
              spellCheck={false}
              autoComplete="off"
              aria-label="Google Cloud Translation key"
              className={cn('h-[26px] min-w-0 flex-auto rounded-md border bg-inset px-[9px] text-[12px] outline-none placeholder:text-ink-dim', state.error ? 'border-destructive' : 'border-border focus:border-primary')}
            />
          )}
          {stored || draft.trim() ? (
            <button type="button" disabled={state.testing} className={strong} onClick={() => void test(stored ?? draft.trim())}>
              {stored ? 'test again' : 'test'}
            </button>
          ) : (
            <span className="flex h-[26px] items-center rounded-md border border-dashed border-border-strong px-[9px] text-ink-dim">test</span>
          )}
          {stored && (
            <button type="button" className={quietButton} onClick={() => void updateSettings({ translateKey: undefined })}>
              clear
            </button>
          )}
        </span>
        <span />
        <span className="flex items-center gap-[7px] text-ink-tertiary">
          <span className={cn('size-1.5 rounded-full', state.error ? 'bg-destructive' : stored ? 'bg-primary' : 'bg-ink-mute')} />
          {state.testing ? 'testing' : state.error ? <span className="text-destructive">{state.error}</span> : stored ? 'key works' : 'no key'}
          {!stored && !state.error && (
            <span className="ml-1">
              · get one in the{' '}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-secondary-foreground underline underline-offset-[3px] hover:text-foreground">
                Google Cloud console
              </a>
            </span>
          )}
        </span>
      </Grid>
    </>
  )
}
