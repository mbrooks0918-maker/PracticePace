import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { OrgProvider } from './context/OrgContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Display from './pages/Display'
import Script from './pages/Script'
import Scoreboard from './pages/Scoreboard'
import Admin from './pages/Admin'
import SpotifyCallback from './pages/SpotifyCallback'
import AcceptInvite    from './pages/AcceptInvite'
import { setupSpotifySDK, startPolling } from './lib/spotifyPlayer'

export default function App() {
  // If the user already has a Spotify token (returning visit / page refresh),
  // kick off the SDK setup and polling. On first connect, SpotifyCallback does this.
  useEffect(() => {
    setupSpotifySDK().catch(() => {})
    startPolling()
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <Routes>
            <Route path="/"                  element={<Login />} />
            <Route path="/onboarding"        element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/dashboard"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/display"           element={<ProtectedRoute><Display /></ProtectedRoute>} />
            <Route path="/script"            element={<ProtectedRoute><Script /></ProtectedRoute>} />
            <Route path="/scoreboard"        element={<ProtectedRoute><Scoreboard /></ProtectedRoute>} />
            <Route path="/admin"             element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/spotify/callback"  element={<SpotifyCallback />} />
            <Route path="/invite"            element={<AcceptInvite />} />
          </Routes>
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
