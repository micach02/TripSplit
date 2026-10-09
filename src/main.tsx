import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { env } from '@/lib/env'
import ConfigErrorPage from '@/pages/ConfigErrorPage'
import '@/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>{env.problem ? <ConfigErrorPage problem={env.problem} /> : <App />}</StrictMode>,
)
