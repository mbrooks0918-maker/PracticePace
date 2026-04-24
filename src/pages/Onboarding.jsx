import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import Tagline from '../components/Tagline'

const SPORTS = [
  'Football', 'Basketball', 'Volleyball', 'Baseball',
  'Softball', 'Soccer', 'Track', 'Wrestling', 'Tennis', 'Other',
]

const STEPS = ['Account Type', 'Program Details', 'Confirmation']

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// ── Shared input style helpers ────────────────────────────────────────────────
const inputBase = {
  backgroundColor: '#1a0000',
  border: '1px solid #2a0000',
  color: '#ffffff',
  caretColor: '#cc1111',
}
const inputClass = 'w-full rounded-lg px-4 py-3 text-sm outline-none transition-all'

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step }) {
  return (
    <div className="w-full flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const num = i + 1
        const active = step === num
        const done = step > num
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  backgroundColor: done ? '#cc1111' : active ? '#cc1111' : '#1a0000',
                  border: active || done ? '2px solid #cc1111' : '2px solid #2a0000',
                  color: active || done ? '#fff' : '#4a2020',
                  boxShadow: active ? '0 0 12px rgba(204,17,17,0.5)' : 'none',
                }}
              >
                {done ? '✓' : num}
              </div>
              <span
                className="text-xs hidden sm:block whitespace-nowrap"
                style={{ color: active || done ? '#cc1111' : '#4a2020' }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mt-0 sm:-mt-4 transition-all"
                style={{ backgroundColor: done ? '#cc1111' : '#2a0000' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ id, title, price, period, badge, features, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className="flex-1 rounded-xl p-5 text-left flex flex-col gap-4 transition-all"
      style={{
        backgroundColor: '#1a0000',
        border: selected ? '2px solid #cc1111' : '2px solid #2a0000',
        boxShadow: selected ? '0 0 20px rgba(204,17,17,0.35)' : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-white text-base">{title}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#cc1111' }}>
            {price}
            <span className="text-sm font-normal" style={{ color: '#9a8080' }}>/{period}</span>
          </p>
        </div>
        {badge && (
          <span
            className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: '#cc1111', color: '#fff' }}
          >
            {badge}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#c0a0a0' }}>
            <span style={{ color: '#cc1111', flexShrink: 0 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <div
        className="mt-auto w-full rounded-lg py-2 text-center text-sm font-semibold transition-all"
        style={{
          backgroundColor: selected ? '#cc1111' : 'transparent',
          border: selected ? '1px solid #cc1111' : '1px solid #2a0000',
          color: selected ? '#fff' : '#9a8080',
        }}
      >
        {selected ? 'Selected' : 'Select'}
      </div>
    </button>
  )
}

// ── Step 1 ────────────────────────────────────────────────────────────────────
function Step1({ accountType, setAccountType }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">Choose your plan</h2>
        <p className="text-sm mt-1" style={{ color: '#9a8080' }}>
          Start free for 30 days — no credit card required.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <PlanCard
          id="single"
          title="Single Program"
          price="$79"
          period="mo"
          features={['1 sport', 'Unlimited coaches', 'Script builder', 'Live display & timer', 'Scoreboard', 'All features']}
          selected={accountType === 'single'}
          onSelect={setAccountType}
        />
        <PlanCard
          id="school"
          title="School — All Programs"
          price="$199"
          period="mo"
          badge="Best Value"
          features={['All sports', 'Unlimited programs', 'Unlimited coaches', 'Script builder', 'Live display & timer', 'Scoreboard', 'All features']}
          selected={accountType === 'school'}
          onSelect={setAccountType}
        />
      </div>
    </div>
  )
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
function Step2({ form, setForm }) {
  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const focusRed = e => (e.target.style.borderColor = '#cc1111')
  const blurGray = e => (e.target.style.borderColor = '#2a0000')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">Program details</h2>
        <p className="text-sm mt-1" style={{ color: '#9a8080' }}>Tell us about your program.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Your full name">
          <input
            type="text"
            required
            value={form.fullName}
            onChange={e => update('fullName', e.target.value)}
            placeholder="Coach Jane Smith"
            className={inputClass}
            style={inputBase}
            onFocus={focusRed}
            onBlur={blurGray}
          />
        </Field>

        <Field label="Program name">
          <input
            type="text"
            required
            value={form.programName}
            onChange={e => update('programName', e.target.value)}
            placeholder="Albertville Aggies Football"
            className={inputClass}
            style={inputBase}
            onFocus={focusRed}
            onBlur={blurGray}
          />
        </Field>

        <Field label="Sport">
          <select
            required
            value={form.sport}
            onChange={e => update('sport', e.target.value)}
            className={inputClass}
            style={{ ...inputBase, appearance: 'none' }}
            onFocus={focusRed}
            onBlur={blurGray}
          >
            <option value="">Select a sport…</option>
            {SPORTS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="School name">
          <input
            type="text"
            required
            value={form.schoolName}
            onChange={e => update('schoolName', e.target.value)}
            placeholder="Albertville High School"
            className={inputClass}
            style={inputBase}
            onFocus={focusRed}
            onBlur={blurGray}
          />
        </Field>

        <div className="flex gap-4">
          <Field label="Primary color">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primaryColor}
                onChange={e => update('primaryColor', e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
                style={{ backgroundColor: 'transparent', border: '1px solid #2a0000', padding: '2px' }}
              />
              <span className="text-sm font-mono" style={{ color: '#9a8080' }}>{form.primaryColor}</span>
            </div>
          </Field>

          <Field label="Secondary color">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.secondaryColor}
                onChange={e => update('secondaryColor', e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
                style={{ backgroundColor: 'transparent', border: '1px solid #2a0000', padding: '2px' }}
              />
              <span className="text-sm font-mono" style={{ color: '#9a8080' }}>{form.secondaryColor}</span>
            </div>
          </Field>
        </div>
      </div>
    </div>
  )
}

// ── Step 3 ────────────────────────────────────────────────────────────────────
function Step3({ accountType, form }) {
  const planLabel = accountType === 'school' ? 'School — All Programs' : 'Single Program'
  const planPrice = accountType === 'school' ? '$199/mo' : '$79/mo'

  const rows = [
    { label: 'Plan', value: `${planLabel} — ${planPrice}` },
    { label: 'Name', value: form.fullName },
    { label: 'Program', value: form.programName },
    { label: 'Sport', value: form.sport },
    { label: 'School', value: form.schoolName },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">Looks good?</h2>
        <p className="text-sm mt-1" style={{ color: '#9a8080' }}>Review your details before starting your trial.</p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a0000' }}>
        {rows.map(({ label, value }, i) => (
          <div
            key={label}
            className="flex items-start justify-between gap-4 px-5 py-3 text-sm"
            style={{ backgroundColor: i % 2 === 0 ? '#110000' : '#1a0000' }}
          >
            <span style={{ color: '#9a8080' }} className="shrink-0">{label}</span>
            <span className="text-white text-right">{value || '—'}</span>
          </div>
        ))}

        {/* Color swatches */}
        <div
          className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
          style={{ backgroundColor: rows.length % 2 === 0 ? '#110000' : '#1a0000' }}
        >
          <span style={{ color: '#9a8080' }}>Colors</span>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full border"
              style={{ backgroundColor: form.primaryColor, borderColor: '#3a0000' }}
            />
            <div
              className="w-6 h-6 rounded-full border"
              style={{ backgroundColor: form.secondaryColor, borderColor: '#3a0000' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [accountType, setAccountType] = useState('')
  const [form, setForm] = useState({
    fullName: '',
    programName: '',
    sport: '',
    schoolName: '',
    primaryColor: '#cc1111',
    secondaryColor: '#ffffff',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function validateStep() {
    if (step === 1 && !accountType) {
      setError('Please select a plan.')
      return false
    }
    if (step === 2) {
      if (!form.fullName.trim()) { setError('Full name is required.'); return false }
      if (!form.programName.trim()) { setError('Program name is required.'); return false }
      if (!form.sport) { setError('Please select a sport.'); return false }
      if (!form.schoolName.trim()) { setError('School name is required.'); return false }
    }
    return true
  }

  function handleNext() {
    setError('')
    if (!validateStep()) return
    setStep(s => s + 1)
  }

  function handleBack() {
    setError('')
    setStep(s => s - 1)
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated.')

      const slug = slugify(form.programName)

      // 1. Insert account
      const { data: account, error: accountErr } = await supabase
        .from('accounts')
        .insert({
          name: form.programName,
          account_type: accountType,
          plan_type: 'monthly',
          status: 'trialing',
        })
        .select()
        .single()
      if (accountErr) throw accountErr

      // 2. Insert organization
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          account_id: account.id,
          name: form.programName,
          slug,
          sport: form.sport,
          primary_color: form.primaryColor,
          secondary_color: form.secondaryColor,
        })
        .select()
        .single()
      if (orgErr) throw orgErr

      // 3. Insert profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          account_id: account.id,
          org_id: org.id,
          email: user.email,
          role: 'owner',
          full_name: form.fullName,
        })
      if (profileErr) throw profileErr

      navigate('/dashboard')
    } catch (err) {
      setError(err.message ?? 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 py-10"
      style={{ backgroundColor: '#080000' }}
    >
      {/* Logo + tagline */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <Logo variant="white" height={44} />
        <Tagline />
      </div>

      {/* Card */}
      <div
        className="w-full max-w-lg rounded-2xl px-6 sm:px-8 py-8 flex flex-col"
        style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}
      >
        <ProgressBar step={step} />

        {step === 1 && <Step1 accountType={accountType} setAccountType={setAccountType} />}
        {step === 2 && <Step2 form={form} setForm={setForm} />}
        {step === 3 && <Step3 accountType={accountType} form={form} />}

        {/* Error */}
        {error && (
          <p
            className="text-sm text-center rounded-lg px-3 py-2 mt-6"
            style={{ backgroundColor: '#2a0000', color: '#ff6666' }}
          >
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ border: '1px solid #2a0000', color: '#9a8080' }}
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{ backgroundColor: '#cc1111' }}
            >
              Next →
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#cc1111' }}
              >
                {loading ? 'Setting up…' : 'Start your free 30-day trial'}
              </button>
              <span className="text-xs" style={{ color: '#4a2020' }}>No credit card required</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
