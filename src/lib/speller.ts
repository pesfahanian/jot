import type { Suggestion } from './spelling'
import type { SpellerRequest, SpellerResponse } from './speller.worker'

// The page's side of the speller worker (lib/speller.worker.ts): started on
// the first word to check, so with spell-check off there is no worker.

let worker: Worker | null = null
let next = 0
const waiting = new Map<number, (r: SpellerResponse['results']) => void>()

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never

function post(msg: WithoutId<SpellerRequest>): Promise<SpellerResponse['results']> {
  if (!worker) {
    worker = new Worker(new URL('./speller.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<SpellerResponse>) => {
      waiting.get(e.data.id)?.(e.data.results)
      waiting.delete(e.data.id)
    }
    worker.onerror = () => {
      for (const done of waiting.values()) done(null)
      waiting.clear()
      worker?.terminate()
      worker = null
    }
  }
  const id = ++next
  return new Promise((resolve) => {
    waiting.set(id, resolve)
    worker!.postMessage({ ...msg, id } as SpellerRequest)
  })
}

// Suggestions for each word in one language, in order; null if that
// language can't be loaded (a pack that isn't installed, a failed fetch).
export const checkWords = (lang: string, items: { word: string; before: string }[]): Promise<(Suggestion | null)[] | null> =>
  items.length ? post({ type: 'check', lang, items }) : Promise.resolve([])

// A removed pack's speller is let go.
export const dropLanguage = (lang: string) => (worker ? post({ type: 'drop', lang }).then(() => undefined) : Promise.resolve())
