import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
if (import.meta.env.DEV) import('@/lib/dev')
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
