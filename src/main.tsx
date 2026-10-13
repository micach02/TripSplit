import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { env } from '@/lib/env'
import { registerServiceWorker } from '@/lib/serviceWorker'
import ConfigErrorPage from '@/pages/ConfigErrorPage'
import '@/index.css'
// Loaded up front, not when Settings opens: one follows system light/dark changes,
// the other catches the browser's one-time install offer.
import '@/lib/theme'
import '@/lib/installPrompt'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>{env.problem ? <ConfigErrorPage problem={env.problem} /> : <App />}</StrictMode>,
)

registerServiceWorker()
