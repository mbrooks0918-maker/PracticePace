import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── Service Worker ────────────────────────────────────────────────────────────
// Unregister any stale service workers from other origins (e.g. Spotify SDK)
// before registering ours, so there's no scope conflict.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      // Remove any SW that isn't ours
      if (!reg.active?.scriptURL.includes('/sw.js')) {
        reg.unregister()
      }
    }
  })

  // Register PracticePace SW after page load so it doesn't delay first paint
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(err => console.warn('[SW] Registration failed:', err))
  })
}
