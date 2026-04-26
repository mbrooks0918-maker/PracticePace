// Vercel serverless function — Spotify token exchange
// Keeps SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET off the browser entirely.
// Called by the frontend instead of hitting Spotify's token endpoint directly.

export const config = { runtime: 'edge' }

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req) {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const clientId     = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET  // optional but recommended

  if (!clientId) {
    console.error('[spotify-token] SPOTIFY_CLIENT_ID env var is not set')
    return new Response(JSON.stringify({ error: 'Server misconfigured — contact support.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { code, code_verifier, redirect_uri, grant_type, refresh_token } = body

  // Build token request params — support both authorization_code and refresh_token grants
  const params = new URLSearchParams({ client_id: clientId })

  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return new Response(JSON.stringify({ error: 'Missing refresh_token' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    params.set('grant_type',    'refresh_token')
    params.set('refresh_token', refresh_token)
  } else {
    // Default: authorization_code (PKCE)
    if (!code || !code_verifier || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing code, code_verifier, or redirect_uri' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    params.set('grant_type',    'authorization_code')
    params.set('code',          code)
    params.set('redirect_uri',  redirect_uri)
    params.set('code_verifier', code_verifier)
  }

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  // If a client secret is configured, use HTTP Basic auth (adds security on top of PKCE)
  if (clientSecret) {
    headers['Authorization'] = `Basic ${btoa(`${clientId}:${clientSecret}`)}`
  }

  let spotifyRes
  try {
    spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers, body: params,
    })
  } catch (err) {
    console.error('[spotify-token] Network error reaching Spotify:', err)
    return new Response(JSON.stringify({ error: 'Could not reach Spotify — try again.' }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const text = await spotifyRes.text()

  if (!spotifyRes.ok) {
    console.error('[spotify-token] Spotify returned error:', spotifyRes.status, text)
    // Try to forward Spotify's own error message if it's JSON
    let errMsg = `Spotify error ${spotifyRes.status}`
    try { errMsg = JSON.parse(text)?.error_description ?? errMsg } catch {}
    return new Response(JSON.stringify({ error: errMsg }), {
      status: spotifyRes.status, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Forward the token payload to the client
  return new Response(text, {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
