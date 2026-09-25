import { useEffect, useState } from 'react'
import { EditorPanel } from '@/components/shell/EditorPanel'
import { Sidebar } from '@/components/shell/Sidebar'
import { StatusBar } from '@/components/shell/StatusBar'

// Floating-panel shell, design system §1.2b: the tray fills the viewport,
// panels sit inside it, and the seam is the canvas showing between them.
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex h-svh flex-col gap-(--seam) overflow-hidden rounded-(--radius-tray) border border-border-tray bg-background p-(--tray-pad) text-foreground">
      <div className="flex min-h-0 flex-auto gap-(--seam)">
        <Sidebar />
        <EditorPanel />
      </div>
      <StatusBar theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
    </div>
  )
}

export default App
