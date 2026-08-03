import './utils/compat' // لازم يفضل أول سطر — بيظبط الأجهزة القديمة قبل أي كود
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
