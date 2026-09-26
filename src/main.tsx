import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)

if (import.meta.env.DEV) void import('@/lib/dev')

// Dev-only design specimens (e.g. /?specimen=keycap for T4.2). The dynamic
// import sits behind import.meta.env.DEV, so production builds drop it.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('specimen') === 'keycap') {
  void import('./dev/KeycapSpecimen').then(({ KeycapSpecimen }) => root.render(<KeycapSpecimen />))
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
