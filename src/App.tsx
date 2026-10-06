import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Shell } from '@/components/shell/Shell'
import { db } from '@/lib/db'
import { setFavicon } from '@/lib/favicon'
import { welcomeIfFirstRun } from '@/lib/welcome'
import { useDocuments } from '@/state/hooks'
import { useReview } from '@/state/review'
import { docIdOf, isDiffTab } from '@/state/layout'
import { useApplyTheme, useTheme } from '@/state/theme'
import { useWorkspace } from '@/state/workspace'

// Desktop only (ADR-011): below 1000px nothing of the app mounts — only the
// too-narrow screen. Resizing across the line swaps live, in either direction.
const MIN_WIDTH = 1000
const wide = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`)
const subscribeWidth = (fn: () => void) => {
  wide.addEventListener('change', fn)
  return () => wide.removeEventListener('change', fn)
}

// A whole-window notice in place of the app: the mark, a heading, a line.
// The tile comes in both themes; only colour differs (ADR-006).
function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-5 bg-background px-8 text-center text-foreground">
      <img src="/tile-light.svg" width={72} height={72} alt="" className="dark:hidden" />
      <img src="/tile-dark.svg" width={72} height={72} alt="" className="hidden dark:block" />
      <div className="flex max-w-[340px] flex-col gap-2">
        <h1 className="text-[17px] font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

// No width number (owner): just that this window isn't wide enough.
function TooNarrow() {
  return <Notice title="jot needs a wider window">It's made for writing at a desk. Widen this window, or open jot on a computer.</Notice>
}

// Storage switched off (data safety): Jot keeps everything in the browser,
// so without IndexedDB — Safari's Lockdown Mode, site data blocked — there
// is nothing it can do. Said plainly instead of failing silently.
function NoStorage() {
  return (
    <Notice title="jot can't save documents here">
      This browser isn't letting websites store data, for example in Safari's Lockdown Mode or with site data blocked. jot keeps your writing in the browser, so it needs that. Allow site data for jot, or use another browser.
    </Notice>
  )
}

// Whether the database opens at all, checked once per load.
const storage: Promise<boolean> = db.open().then(
  () => true,
  () => false,
)
function useStorageOk(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => void storage.then(setOk), [])
  return ok
}

function Workspace() {
  const docs = useDocuments()
  const loaded = useWorkspace((s) => s.loaded)

  // Once the document list is first known: welcome a first run (which
  // creates a document — the list then updates and this runs again), then
  // restore the saved layout. With nothing saved, hydrate opens the most
  // recent document, so a first run opens straight into the welcome.
  useEffect(() => {
    if (!docs || useWorkspace.getState().loaded) return
    void welcomeIfFirstRun(docs.length).then(async () => {
      if (docs.length === 0 && (await db.documents.count()) > 0) return
      if (useWorkspace.getState().loaded) return
      useWorkspace.getState().hydrate(await db.workspace.get('workspace'), docs)
    })
  }, [docs])

  // Tabs of documents that disappear (deleted elsewhere) close themselves.
  useEffect(() => {
    if (!docs || !loaded) return
    const ids = new Set(docs.map((d) => d.id))
    const ws = useWorkspace.getState()
    for (const p of ws.panes) for (const t of p.tabs) if (!isDiffTab(t) && !ids.has(docIdOf(t))) ws.closeTab(p.id, t)
  }, [docs, loaded])

  if (!docs || !loaded) return <div className="h-svh bg-background" />
  return <Shell docs={docs} />
}

// The favicon mirrors the review (lib/favicon.ts): an unseen result first,
// then a review in progress, else the plain mark.
function useFaviconStatus() {
  const running = useReview((s) => Object.values(s.runs).some((r) => r.state === 'running'))
  const unseen = useReview((s) => s.unseen)
  useEffect(() => setFavicon(unseen ?? (running ? 'running' : 'idle')), [running, unseen])
}

function App() {
  const isWide = useSyncExternalStore(subscribeWidth, () => wide.matches)
  const theme = useTheme()
  useApplyTheme(theme.resolved)
  useFaviconStatus()
  const storageOk = useStorageOk()
  if (!isWide) return <TooNarrow />
  if (storageOk === false) return <NoStorage />
  return <Workspace />
}

export default App
