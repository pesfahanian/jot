import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '@/lib/settings'
import { browserOwns, editorCommandFor, formatKey, isCommandKey, isMac, keyOfEvent, normKey } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import { COMMANDS, keysOf, setCommandKeys } from '@/state/commands'
import { useUi } from '@/state/ui'
import { KeyChip, quietButton } from './controls'

// Settings → keyboard shortcuts (round 4, frames 3d–3e): every command with
// its keys, searchable. Click a key to record a new one. A clash shows
// inline before anything is saved: another command's key can be taken
// ("replace it, and … will have no key"), so can one of the editor's; a key
// the browser keeps for itself can't, and says so.

type Issue =
  | { kind: 'command'; other: string; otherTitle: string }
  | { kind: 'editor'; name: string }
  | { kind: 'browser' }
  | { kind: 'modifier' }

const NONE: Record<string, string[]> = {}

interface Editing {
  id: string
  key?: string
  issue?: Issue
}

function issueFor(id: string, key: string, own: Record<string, string[]>): Issue | undefined {
  if (!isCommandKey(key)) return { kind: 'modifier' }
  if (browserOwns(key)) return { kind: 'browser' }
  const other = COMMANDS.find((c) => c.id !== id && keysOf(c.id, own).includes(normKey(key)))
  if (other) return { kind: 'command', other: other.id, otherTitle: other.title }
  const editor = editorCommandFor(key)
  if (editor) return { kind: 'editor', name: editor }
  return undefined
}

export function ShortcutsSection() {
  const own = useLiveQuery(() => getSettings().then((s) => s.shortcuts ?? NONE), []) ?? NONE
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const setRecording = useUi((s) => s.setRecordingKey)
  const recording = !!editing && !editing.key

  // While recording, the next key press is the new key — app shortcuts and
  // the modal's Escape stand aside. Escape cancels; Backspace removes the
  // key.
  useEffect(() => {
    if (!recording) return
    setRecording(true)
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey) return setEditing(null)
      if ((e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        void setCommandKeys(editing!.id, [])
        return setEditing(null)
      }
      const key = keyOfEvent(e)
      if (!key) return
      const issue = issueFor(editing!.id, key, own)
      if (!issue) {
        void setCommandKeys(editing!.id, [key])
        return setEditing(null)
      }
      setEditing({ id: editing!.id, key, issue })
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true })
      setRecording(false)
    }
  }, [recording, editing, own, setRecording])

  const replace = async () => {
    if (!editing?.key || !editing.issue) return
    if (editing.issue.kind === 'command') {
      const other = editing.issue.other
      await setCommandKeys(other, keysOf(other, own).filter((k) => k !== normKey(editing.key!)))
    }
    await setCommandKeys(editing.id, [editing.key])
    setEditing(null)
  }

  const q = query.trim().toLowerCase()
  const shown = COMMANDS.filter((c) => !q || c.title.includes(q) || keysOf(c.id, own).some((k) => formatKey(k).toLowerCase().includes(q) || k.toLowerCase().includes(q)))
  const edited = Object.keys(own).length > 0

  return (
    <div className="flex flex-col gap-3 px-[22px] py-[18px]">
      <div className="flex items-center gap-2.5">
        <span className="flex-auto text-[15px] font-semibold tracking-[-0.02em]">keyboard shortcuts</span>
        <button type="button" className={cn(quietButton, 'h-6 px-2')} disabled={!edited} onClick={() => void updateSettings({ shortcuts: {} })}>
          reset all
        </button>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search commands or keys"
        aria-label="search commands or keys"
        className="h-7 rounded-md border border-border bg-inset px-[9px] text-[12.5px] outline-none placeholder:text-ink-dim focus:border-primary"
      />
      <div className="flex flex-col text-[12.5px]">
        {shown.map((c) => {
          const keys = keysOf(c.id, own)
          const isEditing = editing?.id === c.id
          const changed = c.id in own
          return (
            <div key={c.id} className={cn('flex flex-col gap-2 border-b border-border-subtle', isEditing ? '-mx-1 bg-hover-lift px-2 py-2' : 'px-1 py-[7px]')}>
              <div className="grid items-center gap-2.5" style={{ gridTemplateColumns: 'minmax(0, 1fr) 170px 44px' }}>
                <span className={cn(isEditing && 'font-medium')}>{c.title}</span>
                <button
                  type="button"
                  onClick={() => setEditing(isEditing ? null : { id: c.id })}
                  title="click to record a new key"
                  className="flex min-h-[22px] items-center gap-1 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {isEditing ? (
                    <>
                      <KeyChip active>{editing.key ? formatKey(editing.key) : 'press keys…'}</KeyChip>
                      {keys.length > 0 && <span className="font-mono text-[11px] text-muted-foreground">was {formatKey(keys[0])}</span>}
                    </>
                  ) : keys.length ? (
                    keys.map((k) => <KeyChip key={k}>{formatKey(k)}</KeyChip>)
                  ) : (
                    <span className="font-mono text-[11px] text-ink-dim">no key</span>
                  )}
                  {!isEditing && changed && <span className="font-mono text-[11px] text-muted-foreground">edited</span>}
                </button>
                {changed && !isEditing ? (
                  <button type="button" onClick={() => void setCommandKeys(c.id, null)} className="font-mono text-[11px] text-secondary-foreground underline underline-offset-[3px] hover:text-foreground">
                    reset
                  </button>
                ) : (
                  <span />
                )}
              </div>
              {isEditing && !editing.key && (
                <div className="font-mono text-[11px] text-muted-foreground">press the new keys · esc to cancel · ⌫ for no key</div>
              )}
              {isEditing && editing.key && editing.issue && <Clash keyName={formatKey(editing.key)} issue={editing.issue} onReplace={() => void replace()} onCancel={() => setEditing(null)} />}
            </div>
          )
        })}
      </div>
      <p className="text-[12px] leading-normal text-pretty text-ink-tertiary">The editor's own keys — typing, selection, find, format — follow VS Code and aren't listed here.</p>
    </div>
  )
}

function Clash({ keyName, issue, onReplace, onCancel }: { keyName: string; issue: Issue; onReplace: () => void; onCancel: () => void }) {
  const canReplace = issue.kind === 'command' || issue.kind === 'editor'
  const text =
    issue.kind === 'command' ? (
      <>
        {keyName} is already <strong className="font-semibold text-foreground">{issue.otherTitle}</strong>. Replace it, and {issue.otherTitle} will have no key.
      </>
    ) : issue.kind === 'editor' ? (
      <>
        {keyName} is the editor's <strong className="font-semibold text-foreground">{issue.name}</strong>. Replace it, and the editor loses it.
      </>
    ) : issue.kind === 'browser' ? (
      <>The browser uses {keyName} itself and won't hand it to jot.</>
    ) : (
      <>A shortcut needs {isMac ? '⌘ or ⌃' : 'Ctrl'}{isMac ? ' — ⌥ alone types a character.' : ' or Alt.'}</>
    )
  return (
    <div className="flex items-center gap-2 text-[12px] text-secondary-foreground">
      <span className={cn('size-1.5 flex-none rounded-full', canReplace ? 'bg-destructive' : 'bg-flag-check')} />
      <span className="flex-auto text-pretty">{text}</span>
      <button
        type="button"
        disabled={!canReplace}
        onClick={onReplace}
        className={cn(
          'flex h-[22px] items-center rounded-md border px-[7px] font-mono text-[11px]',
          canReplace ? 'border-foreground bg-foreground text-document' : 'border-border bg-background text-ink-dim',
        )}
      >
        replace
      </button>
      <button type="button" onClick={onCancel} className="flex h-[22px] items-center rounded-md border border-border bg-background px-[7px] font-mono text-[11px]">
        cancel
      </button>
    </div>
  )
}
