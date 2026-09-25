// Static content from the floating-panel frames (8a/8b). Placeholder only:
// the sidebar, tabs and status bar (Phase 3) replace every piece of this.

export type TagSlot = 1 | 2 | 3 | 4 | 5 | 6

export interface SampleFile {
  name: string
  tag?: TagSlot
  pinned?: boolean
  age: string
}

export const pinnedFiles: SampleFile[] = [
  { name: 'platform-migration', tag: 2, pinned: true, age: '2m' },
  { name: 'jot-spec', tag: 4, pinned: true, age: '21d' },
]

export const files: SampleFile[] = [
  { name: 'status-bar', tag: 2, age: '41m' },
  { name: 'scratch', age: '3h' },
  { name: 'deploy-runbook', tag: 3, age: '7h' },
  { name: 'notes/2026-08-30', tag: 1, age: '13d' },
  { name: 'reading-queue', tag: 6, age: '1mo' },
]

export const selectedFile = 'platform-migration'

export const tabs: { name: string; tag?: TagSlot }[] = [
  { name: 'platform-migration', tag: 2 },
  { name: 'jot-spec', tag: 4 },
  { name: 'scratch' },
]

export const cursorLine = 40

export const counters: [label: string, value: string][] = [
  ['bytes', '1 904'],
  ['chars', '1 898'],
  ['words', '312'],
  ['lines', '47'],
  ['paras', '9'],
]
