import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Restore deep-link after GitHub Pages 404 redirect
const redirect = sessionStorage.redirect as string | undefined
delete sessionStorage.redirect
if (redirect && redirect !== location.href) {
  history.replaceState(null, '', redirect)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
