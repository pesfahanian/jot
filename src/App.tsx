import { useEffect, useSyncExternalStore } from 'react'
import { Shell } from '@/components/shell/Shell'
import { db } from '@/lib/db'
import { setFavicon } from '@/lib/favicon'
import { useDocuments } from '@/state/hooks'
import { useReview } from '@/state/review'
import { docIdOf } from '@/state/layout'
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

// No width number (owner): just the mark, and that this window isn't wide
// enough. The tile comes in both themes; only colour differs (ADR-006).
function TooNarrow() {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-5 bg-background px-8 text-center text-foreground">
      <img src="/tile-light.svg" width={72} height={72} alt="" className="dark:hidden" />
      <img src="/tile-dark.svg" width={72} height={72} alt="" className="hidden dark:block" />
      <div className="flex max-w-[300px] flex-col gap-2">
        <h1 className="text-[17px] font-semibold tracking-[-0.02em]">jot needs a wider window</h1>
        <p className="text-[13px] leading-relaxed text-muted-foreground">It's made for writing at a desk. Widen this window, or open jot on a computer.</p>
      </div>
    </div>
  )
}

function Workspace() {
  const docs = useDocuments()
  const loaded = useWorkspace((s) => s.loaded)

  // Restore the saved layout once the document list is first known.
  useEffect(() => {
    if (!docs || useWorkspace.getState().loaded) return
    void db.workspace.get('workspace').then((ws) => useWorkspace.getState().hydrate(ws, docs))
  }, [docs])

  // Tabs of documents that disappear (deleted elsewhere) close themselves.
  useEffect(() => {
    if (!docs || !loaded) return
    const ids = new Set(docs.map((d) => d.id))
    const ws = useWorkspace.getState()
    for (const p of ws.panes) for (const t of p.tabs) if (!ids.has(docIdOf(t))) ws.closeTab(p.id, t)
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
  return isWide ? <Workspace /> : <TooNarrow />
}

export default App
