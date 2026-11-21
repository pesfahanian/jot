import SIZES from './packSizes.json'

// Language packs (owner, 2026-11-21): a language's Hunspell dictionary,
// downloaded from jot.software (public/packs/, scripts/build-packs.mjs) only
// when the person adds it in settings, and kept in the browser's Cache
// Storage under its own name — apart from the offline copy of the app, so
// an update never touches it, and outside the workspace backup. English is
// built in and isn't a pack.

export const PACK_CACHE = 'jot-packs'
const FILES = ['index.aff', 'index.dic'] as const
export const packUrl = (code: string, file: (typeof FILES)[number]) => `/packs/${code}/${file}`

// Download size of each pack, in bytes.
export const packSize = (code: string): number => (SIZES as Record<string, number>)[code] ?? 0

const cache = () => (typeof caches === 'undefined' ? Promise.reject(new Error('no Cache Storage')) : caches.open(PACK_CACHE))

// The packs that are fully downloaded.
export async function installedPacks(): Promise<Set<string>> {
  // Nothing to look at (and nothing created) until a pack was ever added.
  if (typeof caches === 'undefined' || !(await caches.has(PACK_CACHE))) return new Set()
  const keys = await (await cache()).keys()
  const have = new Set(keys.map((r) => new URL(r.url).pathname))
  const codes = new Set([...have].map((p) => /^\/packs\/([^/]+)\//.exec(p)?.[1]).filter((c): c is string => !!c))
  return new Set([...codes].filter((c) => FILES.every((f) => have.has(packUrl(c, f)))))
}

// Downloads a pack; both files or neither.
export async function installPack(code: string): Promise<void> {
  const c = await cache()
  const responses = await Promise.all(
    FILES.map(async (f) => {
      const r = await fetch(packUrl(code, f), { cache: 'no-store' })
      if (!r.ok) throw new Error(`${f}: ${r.status}`)
      return [f, new Response(await r.blob(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })] as const
    }),
  )
  for (const [f, r] of responses) await c.put(packUrl(code, f), r)
}

export async function removePack(code: string): Promise<void> {
  const c = await cache()
  await Promise.all(FILES.map((f) => c.delete(packUrl(code, f))))
}

// A pack's files, for the speller worker; null if it isn't installed.
export async function readPack(code: string): Promise<{ aff: string; dic: string } | null> {
  const c = await cache()
  const [aff, dic] = await Promise.all(FILES.map((f) => c.match(packUrl(code, f))))
  if (!aff || !dic) return null
  return { aff: await aff.text(), dic: await dic.text() }
}
