// Imported first, and deliberately: it rewrites the URL for the public demo
// before any module that reads the query string is evaluated.
import './demo-mode'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
