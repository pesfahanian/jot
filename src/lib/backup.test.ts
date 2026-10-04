import { describe, expect, it } from 'vitest'
import type { JotDocument } from './db'
import { backupName, MANIFEST, packWorkspace, unpackWorkspace, zipPaths } from './backup'

// The workspace backup must round-trip: every document, its text, and the
// metadata markdown can't hold — and nothing that shouldn't travel.

const doc = (title: string, extra: Partial<JotDocument> = {}): JotDocument => ({
  id: crypto.randomUUID(),
  title,
  content: `# ${title}\n\nBody of ${title}.`,
  color: null,
  pinned: false,
  createdAt: 1000,
  updatedAt: 2000,
  ...extra,
})

describe('zipPaths', () => {
  it('names files after titles, a "/" becoming a folder, collisions numbered', () => {
    expect(zipPaths(['notes', 'notes/2026-08-30', 'Notes', 'a:b', ''])).toEqual(['notes.md', 'notes/2026-08-30.md', 'Notes (2).md', 'a-b.md', 'untitled.md'])
  })
})

describe('backupName', () => {
  it('dates the file', () => {
    expect(backupName(new Date(2026, 9, 4))).toBe('jot-workspace-2026-10-04.zip')
  })
})

describe('pack and unpack', () => {
  it('round-trips text, tags, pins and dates', async () => {
    const docs = [doc('alpha', { color: 3, pinned: true }), doc('notes/beta'), doc('alpha', { content: 'second alpha' })]
    const back = await unpackWorkspace(await packWorkspace(docs), 0)
    expect(back.map((d) => [d.title, d.content, d.color, d.pinned, d.createdAt, d.updatedAt]).sort()).toEqual(
      docs.map((d) => [d.title, d.content, d.color, d.pinned, d.createdAt, d.updatedAt]).sort(),
    )
  })

  it('holds only the documents and the manifest', async () => {
    const { unzipSync } = await import('fflate')
    expect(Object.keys(unzipSync(await packWorkspace([doc('a'), doc('b')]))).sort()).toEqual(['a.md', 'b.md', MANIFEST])
  })

  it('reads a plain zip of markdown files, ignoring everything else', async () => {
    const { zipSync, strToU8 } = await import('fflate')
    const zip = zipSync({ 'one.md': strToU8('One'), 'dir/two.txt': strToU8('Two'), 'pic.png': new Uint8Array([1]), '__MACOSX/one.md': strToU8('x') })
    const back = await unpackWorkspace(zip, 5)
    expect(back.map((d) => [d.title, d.content, d.color, d.createdAt]).sort()).toEqual([
      ['dir/two', 'Two', null, 5],
      ['one', 'One', null, 5],
    ])
  })

  it('distrusts a manifest’s values it cannot use', async () => {
    const { zipSync, strToU8 } = await import('fflate')
    const manifest = { format: 'jot-workspace', version: 1, documents: [{ path: 'a.md', title: 'a', color: 9, pinned: 'yes', createdAt: 'x' }] }
    const back = await unpackWorkspace(zipSync({ 'a.md': strToU8('A'), [MANIFEST]: strToU8(JSON.stringify(manifest)) }), 7)
    expect(back[0]).toEqual({ title: 'a', content: 'A', color: null, pinned: false, createdAt: 7, updatedAt: 7 })
  })
})
