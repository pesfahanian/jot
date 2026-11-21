import { useLiveQuery } from 'dexie-react-hooks'
import { ENGLISH, PACKS } from '@/lib/languages'
import { packSize } from '@/lib/packs'
import { getSettings, updateSettings } from '@/lib/settings'
import { usePacks } from '@/state/packs'
import { useUi } from '@/state/ui'
import { quietButton, SectionHead, Segmented } from './controls'

// Settings → languages (owner, 2026-11-21): spell-checking beyond English.
// Each pack is downloaded from jot.software when added and kept in this
// browser until removed (lib/packs.ts); none is downloaded otherwise.
// Latin-script words are checked in one language — English unless another
// pack is chosen here (a document can choose its own in the status bar);
// Farsi and Arabic words in the Farsi pack, or the Arabic one.

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function LanguagesSection() {
  const settings = useLiveQuery(() => getSettings(), [])
  const { installed, busy, error, add, remove } = usePacks()
  const openSettings = useUi((s) => s.openSettings)
  const on = settings?.autofix ?? false
  const latin = settings?.spellLatin ?? 'en'
  const latinChoices = [ENGLISH.code, ...PACKS.filter((p) => p.script === 'latin' && installed.has(p.code)).map((p) => p.code)]
  return (
    <>
      <SectionHead title="languages">
        Spelling suggestions in more languages. English is built in; each other language is a pack, downloaded once from jot.software and kept in this browser until you remove it. Packs aren't part of the workspace backup.
      </SectionHead>
      {!on && (
        <span className="text-[12px] text-ink-tertiary">
          Spelling suggestions are off.{' '}
          <button type="button" className="text-secondary-foreground underline underline-offset-[3px] hover:text-foreground" onClick={() => openSettings('editor')}>
            settings → editor
          </button>
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        {PACKS.map((p) => {
          const have = installed.has(p.code)
          return (
            <div key={p.code} className="flex items-center gap-3">
              <span className="flex flex-auto flex-col gap-0.5">
                <span className="text-[13px] font-medium">{p.name}</span>
                <span className="font-mono text-[11px] text-ink-tertiary">
                  {mb(packSize(p.code))} · {p.licence}
                  {error === p.code && <span className="text-destructive"> · download failed</span>}
                </span>
              </span>
              {busy === p.code ? (
                <span className="font-mono text-[11px] text-ink-tertiary">{have ? 'removing…' : 'downloading…'}</span>
              ) : (
                <button type="button" className={quietButton} disabled={!!busy} onClick={() => void (have ? remove(p.code) : add(p.code))}>
                  {have ? 'remove' : 'add'}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {latinChoices.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="flex flex-auto flex-col gap-0.5">
            <span className="text-[13px] font-medium">latin-script words</span>
            <span className="text-[12px] text-pretty text-ink-tertiary">The language English-alphabet words are checked in. A document can choose its own in the status bar.</span>
          </span>
          <Segmented value={latinChoices.includes(latin) ? latin : 'en'} options={latinChoices} onChange={(code) => void updateSettings({ spellLatin: code })} />
        </div>
      )}
      {installed.has('fa') && installed.has('ar') && <span className="text-[12px] text-ink-tertiary">Farsi and Arabic share a script: Farsi checks it, unless a document chooses Arabic in the status bar.</span>}
    </>
  )
}
