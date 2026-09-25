// Static content from the floating-panel frames (8a/8b). Placeholder only:
// the document model (Phase 1), editor (Phase 2) and sidebar/tabs (Phase 3)
// replace every piece of this.

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

// One entry per editor line. Each segment carries the syntax role it renders in.
export type Seg = { t: string; role?: 'heading' | 'emph' | 'link' | 'code' | 'punct' | 'quote' | 'done' | 'mark' }
export type Line = { segs: Seg[]; block?: 'code' }

export const firstLineNumber = 28
export const cursorLine = 40

export const lines: Line[] = [
  { segs: [{ t: '### ', role: 'heading' }, { t: '3. Rollout', role: 'heading' }] },
  { segs: [] },
  { segs: [{ t: '- ', role: 'punct' }, { t: 'Migrate each service in turn, starting with' }] },
  { segs: [{ t: '  the queue workers, the scheduler, and CI.' }] },
  { segs: [{ t: '- ', role: 'punct' }, { t: 'Every service gets a dry run before cutover.' }] },
  { segs: [] },
  { segs: [{ t: 'Owners ' }, { t: 'must', role: 'emph' }, { t: ' confirm their slot in' }] },
  {
    segs: [
      { t: '[', role: 'punct' },
      { t: 'the shared tracker', role: 'link' },
      { t: '](./notes/tracker.md)', role: 'punct' },
      { t: ' before Friday.' },
    ],
  },
  { segs: [] },
  { segs: [{ t: '  pnpm migrate --service queue --dry-run', role: 'code' }], block: 'code' },
  { segs: [{ t: '  pnpm migrate --service queue --cutover', role: 'code' }], block: 'code' },
  { segs: [] },
  {
    segs: [
      { t: 'Rollback stays live for ' },
      { t: '48h', role: 'code' },
      { t: ' after each ' },
      { t: 'cutover', role: 'mark' },
      { t: '.' },
    ],
  },
  { segs: [] },
  { segs: [{ t: '> ', role: 'punct' }, { t: 'Nothing here changes the freeze window.', role: 'quote' }] },
  { segs: [] },
  { segs: [{ t: '- [ ] ', role: 'punct' }, { t: 'name a backup owner per service' }] },
  { segs: [{ t: '- [x] ', role: 'punct' }, { t: 'book the maintenance channel', role: 'done' }] },
]

export const counters: [label: string, value: string][] = [
  ['bytes', '1 904'],
  ['chars', '1 898'],
  ['words', '312'],
  ['lines', '47'],
  ['paras', '9'],
]
