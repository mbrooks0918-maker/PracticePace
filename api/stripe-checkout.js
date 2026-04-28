// Vercel Edge Function — create a Stripe Checkout Session
// Called by the client when a coach clicks "Start Free Trial" or "Subscribe".
//
// REQUIRED ENV VARS (Vercel → Settings → Environment Variables):
//   STRIPE_SECRET_KEY
//
// Request body: { priceId, accountId, email, orgName }
// Response:     { url }  — redirect the browser to this URL

export const config = { runtime: 'edge' }

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function stripePost(path, params, secretKey) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe error ${res.status}`)
  return data
}

async function stripeGet(path, secretKey) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { 'Authorization': `Bearer ${secretKey}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe error ${res.status}`)
  return data
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    console.error('[stripe-checkout] Missing STRIPE_SECRET_KEY')
    return json({ error: 'Server misconfigured — contact support.' }, 500)
  }

  let body
  try { body = await req.json() } catch { return json({ error: 'Invalid request body' }, 400) }

  const { priceId, accountId, email, orgName } = body
  if (!priceId || !accountId || !email) {
    return json({ error: 'priceId, accountId, and email are required' }, 400)
  }

  try {
    // ── Find or create Stripe customer ────────────────────────────────────────
    const customers = await stripeGet(
      `/customers?email=${encodeURIComponent(email)}&limit=1`,
      secretKey
    )
    let customerId = customers.data?.[0]?.id

    if (!customerId) {
      const createParams = new URLSearchParams({ email })
      createParams.set('metadata[accountId]', accountId)
      if (orgName) createParams.set('metadata[orgName]', orgName)
      const customer = await stripePost('/customers', createParams, secretKey)
      customerId = customer.id
    }

    // ── Create Checkout Session ───────────────────────────────────────────────
    const params = new URLSearchParams({
      customer:                              customerId,
      mode:                                  'subscription',
      'line_items[0][price]':               priceId,
      'line_items[0][quantity]':            '1',
      'subscription_data[trial_period_days]': '14',
      'subscription_data[metadata][accountId]': accountId,
      'subscription_data[metadata][priceId]':   priceId,
      success_url: 'https://practicepace.app/dashboard?subscription=success',
      cancel_url:  'https://practicepace.app/dashboard?subscription=cancelled',
      'metadata[accountId]': accountId,
      'metadata[orgName]':   orgName ?? '',
      'metadata[priceId]':   priceId,
    })

    const session = await stripePost('/checkout/sessions', params, secretKey)
    return json({ url: session.url })
  } catch (err) {
    console.error('[stripe-checkout]', err.message)
    return json({ error: err.message ?? 'Checkout session creation failed' }, 500)
  }
}
