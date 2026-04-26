import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ── Blocking SW + cache cleanup before React renders ─────────────────────────
// Spotify's SDK registers a Service Worker at the root scope ("/").
// A stale or broken instance of that SW intercepts every fetch() on the page —
// including Supabase auth — and hangs them indefinitely.
//
// The previous approach fired cleanup as fire-and-forget, creating a race:
// React could mount and AuthContext could call getSession() before the
// unregister() promises resolved.
//
// Fix: run cleanup inside an async init() and only call createRoot() after
// the awaits complete AND a 500ms settling delay has passed. React — and
// therefore Supabase auth — never starts until the page is SW-free.
// Only target Spotify SWs that are NOT yet activated — a 'redundant' or
// 'installing' SW is a stale/broken leftover from a previous session and safe
// to remove. An 'activated' SW means Spotify is actively using it right now;
// killing it would break audio playback.
function isStaleSpotifySW(reg) {
  const sw  = reg.installing ?? reg.waiting ?? reg.active
  const url = (reg.scriptURL ?? '').toLowerCase()
  if (!url.includes('spotify')) return false
  const state = sw?.state ?? ''
  return state === 'redundant' || state === 'installing'
}

async function init() {
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        regs
          .filter(r => isStaleSpotifySW(r))
          .map(r => {
            console.log('[SW] Unregistering stale Spotify SW before React mount:', r.scope, r.installing?.state ?? r.waiting?.state ?? r.active?.state)
            return r.unregister()
          })
      )
    } catch (e) {
      console.warn('[SW] Unregister error (non-fatal):', e.message)
    }
  }

  if ('caches' in window) {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => {
        console.log('[SW] Deleting cache:', k)
        return caches.delete(k)
      }))
    } catch {}
  }

  // Give the browser a full 1000 ms to finish processing the unregistrations
  // before any fetch() calls are made. Without this gap the browser may still
  // route requests through the SW that was just told to unregister.
  await new Promise(resolve => setTimeout(resolve, 1000))

  // On page close, remove any Spotify SW that registered during this session
  // so it can't intercept fetches on the next load. beforeunload is safe
  // because audio has already stopped when the user navigates away.
  window.addEventListener('beforeunload', () => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.filter(r => (r.scriptURL ?? '').toLowerCase().includes('spotify')).forEach(r => r.unregister()))
      .catch(() => {})
  })

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

init()
