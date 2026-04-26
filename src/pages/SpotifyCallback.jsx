import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exchangeCode } from '../lib/spotify'
import { setupSpotifySDK, startPolling } from '../lib/spotifyPlayer'

export default function SpotifyCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    const err    = params.get('error')

    if (err) {
      setError(`Spotify declined: ${err}`)
      setTimeout(() => navigate('/dashboard'), 3000)
      return
    }

    if (!code) {
      setError('No authorization code received.')
      setTimeout(() => navigate('/dashboard'), 3000)
      return
    }

    exchangeCode(code)
      .then(() => {
        setupSpotifySDK().catch(() => {})  // load SDK now that token is stored
        startPolling()
        navigate('/dashboard')
      })
      .catch(e => {
        setError(e.message ?? 'Failed to connect Spotify.')
        setTimeout(() => navigate('/dashboard'), 3000)
      })
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: '#080000' }}
    >
      {error ? (
        <>
          <p className="text-sm font-semibold" style={{ color: '#ff6666' }}>{error}</p>
          <p className="text-xs" style={{ color: '#9a8080' }}>Redirecting back to dashboard…</p>
        </>
      ) : (
        <>
          <div
            className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: '#1db954', borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-semibold" style={{ color: '#1db954' }}>
            Connecting Spotify…
          </p>
        </>
      )}
    </div>
  )
}
