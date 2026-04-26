import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ── Aggressive service-worker + cache cleanup ─────────────────────────────────
// Spotify's Web Playback SDK registers a Service Worker. If that SW gets into
// a broken state it intercepts ALL fetch() on the page — including Supabase
// auth — and hangs them indefinitely. We nuke every SW and cache entry on
// every page load so there is never a stale SW around when React mounts.
if ('serviceWorker' in navigator) {
  // Fire-and-forget — don't block rendering, just clean up ASAP
  navigator.serviceWorker.getRegistrations()
    .then(regs => Promise.all(regs.map(r => {
      console.log('[SW] Clearing stale service worker:', r.scope)
      return r.unregister()
    })))
    .catch(() => {})
}

if ('caches' in window) {
  caches.keys()
    .then(keys => Promise.all(keys.map(k => {
      console.log('[SW] Deleting cache:', k)
      return caches.delete(k)
    })))
    .catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
