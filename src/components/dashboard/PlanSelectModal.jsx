// ── PlanSelectModal.jsx ───────────────────────────────────────────────────────
// Shown before redirecting to Stripe checkout.
// Lets the coach pick Monthly or Annual, Single or School,
// then calls onConfirm(priceId) to kick off the Stripe redirect.

import { useState } from 'react'

const PLANS = {
  single: {
    label:    'Single Program',
    subtitle: '1 sport · unlimited coaches',
    monthly:  { price: '$79',    period: '/mo',  priceKey: 'VITE_STRIPE_PRICE_SINGLE_MONTHLY' },
    annual:   { price: '$749',   period: '/yr',  priceKey: 'VITE_STRIPE_PRICE_SINGLE_ANNUAL',  badge: 'Save 20%' },
  },
  school: {
    label:    'School — All Programs',
    subtitle: 'All sports · unlimited programs & coaches',
    monthly:  { price: '$199',   period: '/mo',  priceKey: 'VITE_STRIPE_PRICE_SCHOOL_MONTHLY' },
    annual:   { price: '$1,872', period: '/yr',  priceKey: 'VITE_STRIPE_PRICE_SCHOOL_ANNUAL',  badge: 'Save 20%' },
  },
}

function getPriceId(planKey, billing) {
  const envKey = PLANS[planKey][billing].priceKey
  return import.meta.env[envKey] ?? null
}

export default function PlanSelectModal({ onConfirm, onClose, loading, error }) {
  const [billing, setBilling] = useState('monthly')   // 'monthly' | 'annual'
  const [selected, setSelected] = useState('single')  // 'single' | 'school'

  function handleConfirm() {
    const priceId = getPriceId(selected, billing)
    onConfirm(priceId)
  }

  const plan   = PLANS[selected]
  const option = plan[billing]

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg flex flex-col gap-5 rounded-2xl p-6"
        style={{ backgroundColor: '#0d0000', border: '1px solid #2a0000' }}
      >

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Choose your plan</h2>
            <p className="text-sm mt-0.5" style={{ color: '#9a8080' }}>
              Cancel anytime. No hidden fees.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xl leading-none transition-opacity hover:opacity-60 shrink-0"
            style={{ color: '#4a2020' }}
          >
            ✕
          </button>
        </div>

        {/* Billing period toggle */}
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ backgroundColor: '#1a0000' }}
        >
          {['monthly', 'annual'].map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                backgroundColor: billing === b ? '#cc1111' : 'transparent',
                color:           billing === b ? '#fff'    : '#4a2020',
              }}
            >
              {b === 'monthly' ? 'Monthly' : 'Annual'}
              {b === 'annual' && (
                <span
                  className="text-xs font-black px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: billing === 'annual' ? 'rgba(255,255,255,0.2)' : '#2a0000',
                    color:           billing === 'annual' ? '#fff' : '#cc8800',
                  }}
                >
                  Save 20%
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        <div className="flex flex-col sm:flex-row gap-3">
          {Object.entries(PLANS).map(([key, p]) => {
            const opt       = p[billing]
            const isActive  = selected === key
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className="flex-1 rounded-xl p-4 text-left flex flex-col gap-3 transition-all"
                style={{
                  backgroundColor: isActive ? '#1a0000' : '#110000',
                  border:    `2px solid ${isActive ? '#cc1111' : '#2a0000'}`,
                  boxShadow: isActive ? '0 0 24px rgba(204,17,17,0.3)' : 'none',
                }}
              >
                {/* Plan name + badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-white text-sm">{p.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6a4040' }}>{p.subtitle}</p>
                  </div>
                  {opt.badge && (
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: '#cc1111', color: '#fff' }}
                    >
                      {opt.badge}
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black" style={{ color: isActive ? '#cc1111' : '#9a4040' }}>
                    {opt.price}
                  </span>
                  <span className="text-xs" style={{ color: '#6a4040' }}>{opt.period}</span>
                </div>

                {/* Selected indicator */}
                <div
                  className="w-full rounded-lg py-1.5 text-center text-xs font-bold transition-all"
                  style={{
                    backgroundColor: isActive ? '#cc1111' : 'transparent',
                    border:          `1px solid ${isActive ? '#cc1111' : '#2a0000'}`,
                    color:           isActive ? '#fff' : '#4a2020',
                  }}
                >
                  {isActive ? '✓ Selected' : 'Select'}
                </div>
              </button>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <p
            className="text-xs p-3 rounded-lg leading-relaxed"
            style={{ backgroundColor: '#2a0000', color: '#ff6666', border: '1px solid #4a0000' }}
          >
            ⚠ {error}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-black text-white text-base disabled:opacity-50 transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#cc1111', boxShadow: '0 4px 24px rgba(204,17,17,0.4)' }}
        >
          {loading
            ? 'Redirecting to Stripe…'
            : `Subscribe — ${PLANS[selected].label} ${option.price}${option.period}`}
        </button>

        <p className="text-xs text-center" style={{ color: '#3a1818' }}>
          Secure checkout via Stripe · Cancel anytime
        </p>
      </div>
    </div>
  )
}
