import { useEffect, useSyncExternalStore } from 'react'
import { Shell } from '@/components/shell/Shell'
import { db } from '@/lib/db'
import { setFavicon } from '@/lib/favicon'
import { useDocuments } from '@/state/hooks'
import { useReview } from '@/state/review'
import { useApplyTheme, useTheme, type ThemeState } from '@/state/theme'
import { useWorkspace } from '@/state/workspace'

// Desktop only (ADR-011): below 1000px nothing of the app mounts — only this
// message. Resizing across the line swaps live, in either direction.
const MIN_WIDTH = 1000
const wide = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`)
const subscribeWidth = (fn: () => void) => {
  wide.addEventListener('change', fn)
  return () => wide.removeEventListener('change', fn)
}

function TooNarrow() {
  return (
    <div className="flex h-svh items-center justify-center bg-background px-6 text-center font-mono text-[13px] text-foreground">
      Jot needs a window at least {MIN_WIDTH}px wide. Make this one wider.
    </div>
  )
}

function Workspace({ theme }: { theme: ThemeState }) {
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
    for (const p of ws.panes) for (const t of p.tabs) if (!ids.has(t)) ws.closeTab(p.id, t)
  }, [docs, loaded])

  if (!docs || !loaded) return <div className="h-svh bg-background" />
  return <Shell docs={docs} theme={theme} />
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
  return isWide ? <Workspace theme={theme} /> : <TooNarrow />
}

export default App
