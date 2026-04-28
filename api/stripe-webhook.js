// Vercel Serverless Function (Node.js) — Stripe webhook handler
// Uses Node.js runtime so we can read the raw request body for
// Stripe signature verification. bodyParser must be disabled.
//
// REQUIRED ENV VARS:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// REQUIRED SQL MIGRATIONS (run in Supabase SQL editor):
//   -- Add past_due status, tier, and price_id columns
//   ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
//   ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
//     CHECK (status IN ('trialing','active','canceled','past_due'));
//   ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tier   text DEFAULT 'single' CHECK (tier IN ('single','school'));
//   ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_id text;
//
// Configure webhook in Stripe dashboard:
//   Endpoint URL: https://practicepace.app/api/stripe-webhook
//   Events: checkout.session.completed, customer.subscription.updated,
//           customer.subscription.deleted, invoice.payment_failed

import crypto from 'crypto'

export const config = { api: { bodyParser: false } }

// ── Stripe signature verification ────────────────────────────────────────────
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) throw new Error('Missing stripe-signature header')

  const parts     = sigHeader.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
  const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3))

  if (!timestamp || signatures.length === 0) throw new Error('Invalid stripe-signature format')

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    throw new Error('Webhook timestamp too old — possible replay attack')
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  const match = signatures.some(s => {
    try { return crypto.timingSafeEqual(Buffer.from(s, 'hex'), Buffer.from(expected, 'hex')) }
    catch { return false }
  })

  if (!match) throw new Error('Webhook signature mismatch')
}

// ── Supabase REST helpers (service role, bypasses RLS) ───────────────────────
function sbHeaders(serviceKey) {
  return {
    'Content-Type':  'application/json',
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  }
}

async function sbSelect(table, filter, supabaseUrl, serviceKey) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}&select=id,org_id`, {
    headers: sbHeaders(serviceKey),
  })
  if (!res.ok) throw new Error(`Supabase select failed: ${await res.text()}`)
  return res.json()
}

async function sbPatch(table, filter, data, supabaseUrl, serviceKey) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method:  'PATCH',
    headers: { ...sbHeaders(serviceKey), 'Prefer': 'return=representation' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Supabase patch failed: ${await res.text()}`)
  return res.json()   // array of updated rows (empty if no match)
}

async function sbInsert(table, data, supabaseUrl, serviceKey) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method:  'POST',
    headers: { ...sbHeaders(serviceKey), 'Prefer': 'return=minimal' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Supabase insert failed: ${await res.text()}`)
}

// ── Plan / tier helpers ───────────────────────────────────────────────────────
function getPlan(priceId) {
  const annualIds = [
    process.env.STRIPE_PRICE_SINGLE_ANNUAL,
    process.env.STRIPE_PRICE_SCHOOL_ANNUAL,
  ]
  return annualIds.includes(priceId) ? 'annual' : 'monthly'
}

function getTier(priceId) {
  const schoolIds = [
    process.env.STRIPE_PRICE_SCHOOL_MONTHLY,
    process.env.STRIPE_PRICE_SCHOOL_ANNUAL,
  ]
  return schoolIds.includes(priceId) ? 'school' : 'single'
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Read raw body as Buffer
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const rawBody = Buffer.concat(chunks).toString('utf8')

  // Verify Stripe signature
  try {
    verifyStripeSignature(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe-webhook] Signature error:', err.message)
    res.status(400).json({ error: `Webhook Error: ${err.message}` })
    return
  }

  const event       = JSON.parse(rawBody)
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[stripe-webhook] Missing Supabase env vars')
    res.status(500).json({ error: 'Server misconfigured' })
    return
  }

  try {
    switch (event.type) {

      // ── New subscriber (trial starts) ──────────────────────────────────────
      case 'checkout.session.completed': {
        const session        = event.data.object
        const orgId          = session.metadata?.accountId
        const customerId     = session.customer
        const subscriptionId = session.subscription
        const priceId        = session.metadata?.priceId

        if (!orgId || !customerId || !subscriptionId) {
          console.warn('[stripe-webhook] checkout.session.completed: missing metadata', session.id)
          break
        }

        // Fetch the subscription to get trial_end
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        })
        const sub = await subRes.json()
        const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null

        const payload = {
          stripe_customer_id:     customerId,
          stripe_subscription_id: subscriptionId,
          status:                 'trialing',
          plan:                   getPlan(priceId),
          tier:                   getTier(priceId),
          price_id:               priceId,
          trial_ends_at:          trialEndsAt,
        }

        // Upsert: update if row exists for org, otherwise insert
        const existing = await sbSelect('subscriptions', `org_id=eq.${orgId}`, supabaseUrl, serviceKey)
        if (existing.length > 0) {
          await sbPatch('subscriptions', `org_id=eq.${orgId}`, payload, supabaseUrl, serviceKey)
        } else {
          await sbInsert('subscriptions', { org_id: orgId, ...payload }, supabaseUrl, serviceKey)
        }

        console.log(`[stripe-webhook] checkout.session.completed: org ${orgId} → trialing`)
        break
      }

      // ── Subscription status changed (active, past_due, canceled, etc.) ────
      case 'customer.subscription.updated': {
        const sub            = event.data.object
        const subscriptionId = sub.id
        const status         = sub.status   // trialing|active|past_due|canceled|...
        const trialEndsAt    = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
        const priceId        = sub.items?.data?.[0]?.price?.id

        const payload = {
          status,
          ...(trialEndsAt && { trial_ends_at: trialEndsAt }),
          ...(priceId && { plan: getPlan(priceId), tier: getTier(priceId), price_id: priceId }),
        }

        const updated = await sbPatch(
          'subscriptions',
          `stripe_subscription_id=eq.${subscriptionId}`,
          payload,
          supabaseUrl,
          serviceKey
        )

        console.log(`[stripe-webhook] subscription.updated: ${subscriptionId} → ${status} (${updated.length} rows)`)
        break
      }

      // ── Subscription canceled / deleted ────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscriptionId = event.data.object.id
        await sbPatch(
          'subscriptions',
          `stripe_subscription_id=eq.${subscriptionId}`,
          { status: 'canceled' },
          supabaseUrl,
          serviceKey
        )
        console.log(`[stripe-webhook] subscription.deleted: ${subscriptionId} → canceled`)
        break
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice        = event.data.object
        const subscriptionId = invoice.subscription
        const customerId     = invoice.customer

        // Prefer subscription ID for precision; fall back to customer ID
        const filter = subscriptionId
          ? `stripe_subscription_id=eq.${subscriptionId}`
          : `stripe_customer_id=eq.${customerId}`

        await sbPatch('subscriptions', filter, { status: 'past_due' }, supabaseUrl, serviceKey)
        console.log(`[stripe-webhook] invoice.payment_failed: sub ${subscriptionId ?? customerId} → past_due`)
        break
      }

      default:
        // Unhandled event — return 200 so Stripe doesn't retry
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err.message)
    res.status(500).json({ error: 'Webhook handler error' })
  }
}
