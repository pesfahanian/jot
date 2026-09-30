import { ArrowUp, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Provider } from '@/lib/db'
import { setProviderModels } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { PROVIDERS } from '@/review/providers'

// The model picker (Phase 12): the model reviews run on, then its
// fallbacks, tried in order when a model is overloaded or out of quota.
// Suggestions come from the provider's own model list; any id can be typed.

// Model lists, read once per provider and key while the app is open.
const lists = new Map<string, Promise<string[]>>()
function modelList(provider: Provider, key: string | null): Promise<string[]> {
  const id = `${provider}\n${key ?? ''}`
  if (!lists.has(id))
    lists.set(
      id,
      PROVIDERS[provider].listModels(key ?? '').catch(() => {
        lists.delete(id)
        return []
      }),
    )
  return lists.get(id)!
}

const MAX_SUGGESTIONS = 6
const NONE: string[] = []
const rowButton = 'flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'

export function ModelChain({ provider, chain, custom, apiKey }: { provider: Provider; chain: string[]; custom: boolean; apiKey: string | null }) {
  const [draft, setDraft] = useState('')
  const [loaded, setLoaded] = useState<{ id: string; list: string[] }>({ id: '', list: [] })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  // OpenRouter's list is public; the others need a key that works.
  const canList = provider === 'openrouter' || !!apiKey
  const listId = canList ? `${provider}\n${apiKey ?? ''}` : ''
  useEffect(() => {
    if (!listId) return
    let live = true
    void modelList(provider, apiKey).then((list) => live && setLoaded({ id: listId, list }))
    return () => {
      live = false
    }
  }, [listId, provider, apiKey])
  // Only the list for this provider and key; another's may still be here.
  const known = loaded.id === listId ? loaded.list : NONE

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (!q) return []
    return known.filter((m) => m.toLowerCase().includes(q) && !chain.includes(m)).slice(0, MAX_SUGGESTIONS)
  }, [draft, known, chain])

  const save = (next: string[]) => {
    const isDefault = next.length === PROVIDERS[provider].defaultChain.length && next.every((m, i) => m === PROVIDERS[provider].defaultChain[i])
    void setProviderModels(provider, isDefault ? null : next)
  }
  const add = (model: string) => {
    const m = model.trim()
    if (!m || chain.includes(m)) return
    save([...chain, m])
    setDraft('')
    setOpen(false)
  }
  const remove = (i: number) => save(chain.filter((_, j) => j !== i))
  const raise = (i: number) => save(chain.map((m, j) => (j === i - 1 ? chain[i] : j === i ? chain[i - 1] : m)))

  const showList = open && suggestions.length > 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2 font-mono text-[11px] text-muted-foreground">
        <span className="flex-auto">models</span>
        {custom && (
          <button type="button" onClick={() => void setProviderModels(provider, null)} className="hover:text-foreground">
            reset
          </button>
        )}
      </div>
      <ol className="flex flex-col overflow-hidden rounded-md border border-border bg-background font-mono text-[12px]">
        {chain.map((m, i) => (
          <li key={m} className="group flex h-7 items-center gap-2 border-b border-border pr-1 pl-2.5 last:border-b-0">
            <span className="w-[56px] flex-none text-[10.5px] text-muted-foreground">{i === 0 ? 'model' : 'fallback'}</span>
            <span className={cn('min-w-0 flex-auto truncate', i === 0 ? 'text-foreground' : 'text-secondary-foreground')} title={m}>
              {m}
            </span>
            {i > 0 && (
              <button type="button" aria-label={`try ${m} earlier`} title="try earlier" onClick={() => raise(i)} className={rowButton}>
                <ArrowUp size={12} strokeWidth={2} aria-hidden />
              </button>
            )}
            {chain.length > 1 && (
              <button type="button" aria-label={`remove ${m}`} title="remove" onClick={() => remove(i)} className={rowButton}>
                <X size={12} strokeWidth={2} aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="relative">
        <input
          ref={input}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && showList) {
              e.preventDefault()
              setActive((a) => (a + 1) % suggestions.length)
            } else if (e.key === 'ArrowUp' && showList) {
              e.preventDefault()
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              add(showList ? suggestions[active] : draft)
            } else if (e.key === 'Escape' && (showList || draft)) {
              // Closes the suggestions (then clears the field) before the panel.
              e.stopPropagation()
              if (showList) setOpen(false)
              else setDraft('')
            }
          }}
          placeholder={canList ? 'add a fallback — type to search' : 'add a fallback — model id'}
          spellCheck={false}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls="model-suggestions"
          aria-label="add a model"
          className="h-7 w-full rounded-md border border-border bg-background px-2.5 font-mono text-[12px] text-foreground outline-none placeholder:text-ink-dim focus:border-primary"
        />
        {showList && (
          <ul
            id="model-suggestions"
            role="listbox"
            className="absolute inset-x-0 bottom-[calc(100%+4px)] z-10 overflow-hidden rounded-md border border-border-float bg-popover p-1 font-mono text-[12px]"
          >
            {suggestions.map((m, i) => (
              <li
                key={m}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: the field's blur would close the list first.
                onMouseDown={(e) => {
                  e.preventDefault()
                  add(m)
                }}
                onMouseEnter={() => setActive(i)}
                className={cn('flex h-6 cursor-default items-center truncate rounded-[5px] px-2', i === active ? 'bg-hover-lift text-foreground' : 'text-secondary-foreground')}
              >
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
