import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Unregister any stale service workers (e.g. from Spotify Web Playback SDK).
// A corrupted or stale SW intercepts ALL fetch() calls on the page —
// including Supabase auth — and can make them hang indefinitely.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      console.log('[SW] Unregistering stale service worker:', reg.scope)
      reg.unregister()
    }
  }).catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
