import type { JotDocument, TagColor } from './db'

// The whole workspace as one .zip (data safety): the backup, and the way
// to move between browsers, profiles or an installed app, each of which
// keeps its own separate storage. One .md per document — readable anywhere
// — plus jot-workspace.json for what markdown can't hold: colour tags, pins
// and dates. Never keys, settings or review sessions: a backup file gets
// passed around.
//
// Importing adds the documents alongside what's already there; it never
// replaces anything. The zip library loads only when a backup is made or
// read.

export const MANIFEST = 'jot-workspace.json'

interface ManifestEntry {
  path: string
  title: string
  color: TagColor | null
  pinned: boolean
  createdAt: number
  updatedAt: number
}

interface Manifest {
  format: 'jot-workspace'
  version: 1
  exportedAt: number
  documents: ManifestEntry[]
}

export type ImportedDocument = Omit<JotDocument, 'id'>

const segment = (s: string) => s.replace(/[\\:*?"<>|]+/g, '-').trim() || 'untitled'

// Where each document goes in the zip: its title as the file name, a "/"
// in the title as a folder, and a number when two would collide.
export function zipPaths(titles: string[]): string[] {
  const taken = new Set<string>()
  return titles.map((title) => {
    const base = title.split('/').map(segment).join('/')
    let path = `${base}.md`
    for (let n = 2; taken.has(path.toLowerCase()); n++) path = `${base} (${n}).md`
    taken.add(path.toLowerCase())
    return path
  })
}

// "jot-workspace-2026-10-04.zip", in the person's own date.
export function backupName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `jot-workspace-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.zip`
}

export async function packWorkspace(docs: JotDocument[], exportedAt = Date.now()): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import('fflate')
  const paths = zipPaths(docs.map((d) => d.title))
  const files: Record<string, Uint8Array> = {}
  const manifest: Manifest = { format: 'jot-workspace', version: 1, exportedAt, documents: [] }
  docs.forEach((d, i) => {
    files[paths[i]] = strToU8(d.content)
    manifest.documents.push({ path: paths[i], title: d.title, color: d.color, pinned: d.pinned, createdAt: d.createdAt, updatedAt: d.updatedAt })
  })
  files[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2))
  return zipSync(files)
}

const TAGS = new Set([1, 2, 3, 4, 5, 6])

// The documents in a backup. Without a manifest (a zip of .md files from
// anywhere), every .md / .markdown / .txt file comes in, titled after its
// path. Anything else in the zip is ignored.
export async function unpackWorkspace(bytes: Uint8Array, now = Date.now()): Promise<ImportedDocument[]> {
  const { unzipSync, strFromU8 } = await import('fflate')
  const files = unzipSync(bytes)
  let entries: Partial<ManifestEntry>[] = []
  try {
    const m = JSON.parse(strFromU8(files[MANIFEST])) as Partial<Manifest>
    if (m.format === 'jot-workspace' && Array.isArray(m.documents)) entries = m.documents
  } catch {
    /* no manifest, or not ours */
  }
  const byPath = new Map(entries.filter((e) => typeof e.path === 'string').map((e) => [e.path!, e]))
  const docs: ImportedDocument[] = []
  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith('/') || path.startsWith('__MACOSX/') || !/\.(md|markdown|txt)$/i.test(path)) continue
    const e = byPath.get(path)
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : now)
    docs.push({
      title: typeof e?.title === 'string' && e.title.trim() ? e.title : path.replace(/\.(md|markdown|txt)$/i, ''),
      content: strFromU8(data),
      color: TAGS.has(e?.color as number) ? (e!.color as TagColor) : null,
      pinned: e?.pinned === true,
      createdAt: num(e?.createdAt),
      updatedAt: num(e?.updatedAt),
    })
  }
  return docs
}
