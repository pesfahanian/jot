import { useEffect, useRef, useState } from 'react'
import { EditorPanel } from '@/components/shell/EditorPanel'
import { Sidebar } from '@/components/shell/Sidebar'
import { StatusBar } from '@/components/shell/StatusBar'
import type { JotDocument } from '@/lib/db'
import { createDocument, listDocuments } from '@/lib/documents'

// Until the sidebar and tabs are real (T3.1, T3.2), the app opens the most
// recently edited document, creating an empty one on first run.
async function openInitialDocument(): Promise<JotDocument> {
  const docs = await listDocuments()
  if (docs.length === 0) return createDocument()
  return docs.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
}

// Floating-panel shell, design system §1.2b: the tray fills the viewport,
// panels sit inside it, and the seam is the canvas showing between them.
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const [doc, setDoc] = useState<JotDocument | null>(null)
  const opened = useRef(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    // StrictMode runs effects twice in dev; this must not create two documents.
    if (opened.current) return
    opened.current = true
    void openInitialDocument().then(setDoc)
  }, [])

  return (
    <div className="flex h-svh flex-col gap-(--seam) overflow-hidden rounded-(--radius-tray) border border-border-tray bg-background p-(--tray-pad) text-foreground">
      <div className="flex min-h-0 flex-auto gap-(--seam)">
        <Sidebar />
        <EditorPanel doc={doc} onContentChange={(content) => setDoc((d) => d && { ...d, content })} />
      </div>
      <StatusBar theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
    </div>
  )
}

export default App
