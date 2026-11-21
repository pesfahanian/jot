import { hunspellSpeller } from './hunspell'
import { LANGUAGE } from './languages'
import { readPack } from './packs'
import { setFrequencies, suggestionFor, type Speller, type Suggestion } from './spelling'

// The speller (open decision #30): Hunspell for every language, in a worker
// of its own so loading a dictionary and working out suggestions never
// holds up typing. English is built in (public/dict/, part of the offline
// copy); packs come from Cache Storage (lib/packs.ts). Each language loads
// on its first word and stays loaded until its pack is removed.

export type SpellerRequest =
  | { id: number; type: 'check'; lang: string; items: { word: string; before: string }[] }
  | { id: number; type: 'drop'; lang: string }
export type SpellerResponse = { id: number; results: (Suggestion | null)[] | null }

const spellers = new Map<string, Promise<(Speller & { dispose(): void }) | null>>()

async function text(url: string) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.text()
}

function load(lang: string) {
  let s = spellers.get(lang)
  if (s) return s
  s = (async () => {
    if (lang === 'en') {
      const [aff, dic, freq] = await Promise.all([text('/dict/en.aff'), text('/dict/en.dic'), text('/dict/en.freq').catch(() => '')])
      setFrequencies(freq)
      return hunspellSpeller(aff, dic, { ownSuggestions: false })
    }
    const pack = await readPack(lang)
    return pack ? hunspellSpeller(pack.aff, pack.dic, { ownSuggestions: true }) : null
  })()
  // A failed load is tried again next time.
  s.catch(() => spellers.delete(lang))
  spellers.set(lang, s)
  return s
}

self.onmessage = async (e: MessageEvent<SpellerRequest>) => {
  const msg = e.data
  if (msg.type === 'drop') {
    const s = spellers.get(msg.lang)
    spellers.delete(msg.lang)
    void s?.then((sp) => sp?.dispose()).catch(() => {})
    return self.postMessage({ id: msg.id, results: null } satisfies SpellerResponse)
  }
  const language = LANGUAGE.get(msg.lang)
  const spell = language ? await load(msg.lang).catch(() => null) : null
  const results = spell && language ? msg.items.map((it) => suggestionFor(spell, it.word, it.before, language)) : null
  self.postMessage({ id: msg.id, results } satisfies SpellerResponse)
}
