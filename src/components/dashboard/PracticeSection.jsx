import { useState, useEffect, useRef } from 'react'
import { playAirHorn, playWhistle, playPeriodEnd, loadHorn, getAutoSounds, setAutoSound } from '../../lib/sounds'
import { duckForHorn } from '../../lib/audioPlayer'

function pad(n) { return String(n).padStart(2, '0') }
function fmt(s) { return `${pad(Math.floor(Math.abs(s) / 60))}:${pad(Math.abs(s) % 60)}` }

function clockColor(left, total) {
  if (!total || total <= 0) return '#22c55e'
  const pct = left / total
  if (pct > 0.6) return '#22c55e'
  if (pct > 0.3) return '#f59e0b'
  return '#ef4444'
}

// Duck MP3 volume → play horn → restore after 3 s
function blowHorn() { duckForHorn(playAirHorn) }

// ── Practice prefs (localStorage) ─────────────────────────────────────────────
function getPracticePrefs() {
  try { return JSON.parse(localStorage.getItem('pp_practice_prefs') ?? '{}') } catch { return {} }
}
function savePracticePref(key, val) {
  const cur = getPracticePrefs()
  localStorage.setItem('pp_practice_prefs', JSON.stringify({ ...cur, [key]: val }))
}

const TIME_PRESETS = [5, 10, 15, 20]

// ── Toggle button ──────────────────────────────────────────────────────────────
function ToggleBtn({ label, active, onColor = '#22c55e', onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
      style={{
        backgroundColor: active ? `${onColor}22` : '#110000',
        border:          `1px solid ${active ? onColor : '#2a0000'}`,
        color:           active ? onColor : '#4a2020',
      }}
    >
      <span
        className="w-7 h-4 rounded-full relative flex-shrink-0"
        style={{ backgroundColor: active ? onColor : '#2a0000' }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all"
          style={{ left: active ? '14px' : '2px' }}
        />
      </span>
      {label}
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PracticeSection({ activeScript, orgColor, backgroundUrl }) {
  const drills = activeScript?.drills ?? []

  const [drillIdx,       setDrillIdx]       = useState(0)
  const [secondsLeft,    setSecondsLeft]     = useState(0)
  const [isRunning,      setIsRunning]       = useState(false)
  const [hasStarted,     setHasStarted]      = useState(false)
  const [overrunSecs,    setOverrunSecs]     = useState(0)
  const [inOverrun,      setInOverrun]       = useState(false)
  const [manualDuration, setManualDuration]  = useState(300)

  // ── Coach preference toggles ───────────────────────────────────────────────
  const [autoAdvance,  setAutoAdvance]  = useState(() => getPracticePrefs().autoAdvance  ?? true)
  const [allowOverrun, setAllowOverrun] = useState(() => getPracticePrefs().allowOverrun ?? false)

  // ── Auto-sound toggles (same localStorage keys as Audio tab) ──────────────
  const [hornOnEnd,    setHornOnEnd]    = useState(() => getAutoSounds().hornOnEnd    ?? true)
  const [whistleAt60,  setWhistleAt60]  = useState(() => getAutoSounds().whistleAt60  ?? true)

  const idxRef          = useRef(0)
  const scriptRef       = useRef(activeScript)
  const totalRef        = useRef(0)
  const inOverrunRef    = useRef(false)
  const hornFiredRef    = useRef(false)
  const autoAdvanceRef  = useRef(autoAdvance)
  const allowOverrunRef = useRef(allowOverrun)

  useEffect(() => { scriptRef.current    = activeScript },  [activeScript])
  useEffect(() => { inOverrunRef.current = inOverrun },     [inOverrun])
  useEffect(() => { autoAdvanceRef.current  = autoAdvance },  [autoAdvance])
  useEffect(() => { allowOverrunRef.current = allowOverrun }, [allowOverrun])
  useEffect(() => { resetAll() }, [activeScript])

  function resetAll() {
    setIsRunning(false); setHasStarted(false)
    setInOverrun(false); inOverrunRef.current = false
    setOverrunSecs(0); setDrillIdx(0); idxRef.current = 0
    hornFiredRef.current = false
    const dur = activeScript?.drills?.[0]?.duration ?? manualDuration
    setSecondsLeft(dur); totalRef.current = dur
  }

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      if (inOverrunRef.current) { setOverrunSecs(s => s + 1); return }
      setSecondsLeft(prev => {
        // Whistle at 60s remaining
        if (prev === 61) {
          const sounds = getAutoSounds()
          if (sounds.whistleAt60) playWhistle()
        }

        if (prev <= 1) {
          if (!hornFiredRef.current) {
            hornFiredRef.current = true
            const sounds = getAutoSounds()
            if (sounds.hornOnEnd !== false) blowHorn()
          }

          // Auto-advance to next drill?
          if (autoAdvanceRef.current) {
            const d   = scriptRef.current?.drills ?? []
            const nxt = idxRef.current + 1
            if (nxt < d.length) {
              hornFiredRef.current = false
              idxRef.current = nxt; setDrillIdx(nxt)
              const dur = d[nxt].duration ?? 0; totalRef.current = dur; return dur
            }
          }

          // Overrun allowed?
          if (allowOverrunRef.current) {
            setInOverrun(true); inOverrunRef.current = true
            return 0
          }

          setIsRunning(false); return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning])

  // Fire overrun alert once when overrun begins
  const overrunStartedRef = useRef(false)
  useEffect(() => {
    if (inOverrun && !overrunStartedRef.current) {
      overrunStartedRef.current = true
      const sounds = getAutoSounds()
      if (sounds.alertOnOverrun) playPeriodEnd()
    }
    if (!inOverrun) overrunStartedRef.current = false
  }, [inOverrun])

  // ── Navigation helpers ────────────────────────────────────────────────────
  function jumpTo(i) {
    setInOverrun(false); inOverrunRef.current = false
    setOverrunSecs(0); setIsRunning(false); hornFiredRef.current = false
    idxRef.current = i; setDrillIdx(i)
    const dur = drills[i]?.duration ?? manualDuration
    setSecondsLeft(dur); totalRef.current = dur
  }

  function goPrev() { if (drillIdx > 0) jumpTo(drillIdx - 1) }

  function hornAndAdvance() {
    blowHorn()
    const next = drillIdx + 1
    if (next < drills.length) { jumpTo(next) } else { setIsRunning(false) }
  }

  // ── Time adjustment ───────────────────────────────────────────────────────
  function setTimeTo(secs) {
    setIsRunning(false)
    setSecondsLeft(secs)
    totalRef.current = secs
    setInOverrun(false); inOverrunRef.current = false
    setOverrunSecs(0); hornFiredRef.current = false
    // Update manualDuration so Quick Timer remembers it
    if (!activeScript) setManualDuration(secs)
  }

  function addMinute() {
    setSecondsLeft(prev => {
      const newVal = prev + 60
      if (newVal > totalRef.current) totalRef.current = newVal
      return newVal
    })
    if (inOverrunRef.current) {
      setInOverrun(false); inOverrunRef.current = false; setOverrunSecs(0)
    }
  }

  // ── Toggles ───────────────────────────────────────────────────────────────
  function toggleAutoAdvance() {
    const val = !autoAdvance; setAutoAdvance(val); savePracticePref('autoAdvance', val)
  }
  function toggleAllowOverrun() {
    const val = !allowOverrun; setAllowOverrun(val); savePracticePref('allowOverrun', val)
  }
  function toggleHornOnEnd() {
    const val = !hornOnEnd; setHornOnEnd(val); setAutoSound('hornOnEnd', val)
  }
  function toggleWhistleAt60() {
    const val = !whistleAt60; setWhistleAt60(val); setAutoSound('whistleAt60', val)
  }

  function handleStart() {
    loadHorn()
    setIsRunning(r => !r); setHasStarted(true)
  }

  const currentDrill = drills[drillIdx]
  const nextDrill    = drills[drillIdx + 1]
  const pct          = totalRef.current ? (secondsLeft / totalRef.current) * 100 : 0
  const color        = inOverrun ? '#ef4444' : clockColor(secondsLeft, totalRef.current)
  const isDone       = hasStarted && !isRunning && secondsLeft === 0 && !inOverrun && drillIdx >= drills.length - 1
  const clockDisplay = inOverrun ? `+${fmt(overrunSecs)}` : fmt(secondsLeft)
  const isLastDrill  = drillIdx >= drills.length - 1

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex-1 flex flex-col overflow-hidden relative"
      style={{
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {backgroundUrl && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: 'rgba(0,0,0,0.72)' }} />
      )}

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden px-4 pb-2 gap-0">

        {/* ── 1. Script name + period dots ────────────────────────────────── */}
        <div className="shrink-0 flex flex-col items-center gap-1.5 pt-2 pb-1">
          {activeScript ? (
            <>
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6a4040' }}>
                {activeScript.name}
              </p>
              {drills.length <= 30 ? (
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {drills.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => jumpTo(i)}
                      title={drills[i].name}
                      className="rounded-full transition-all"
                      style={{
                        width:           i === drillIdx ? 10 : 7,
                        height:          i === drillIdx ? 10 : 7,
                        backgroundColor: i <= drillIdx ? orgColor : '#2a0000',
                        opacity:         i < drillIdx ? 0.35 : 1,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs font-semibold" style={{ color: '#6a4040' }}>
                  {drillIdx + 1} / {drills.length}
                </p>
              )}
            </>
          ) : (
            <div className="text-center">
              <p className="font-bold text-white text-sm">Quick Timer</p>
              <p className="text-xs" style={{ color: '#9a8080' }}>
                Go to Scripts and tap Set Active to load a script.
              </p>
            </div>
          )}
        </div>

        {/* ── 2. Current segment name ─────────────────────────────────────── */}
        <div className="shrink-0 flex items-end justify-center pb-1" style={{ minHeight: 52 }}>
          {currentDrill ? (
            <h1
              className="text-center leading-none tracking-wide"
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(2.8rem, 6.5vw, 5rem)',
                color: '#ffffff',
                letterSpacing: '0.04em',
                textShadow: '0 2px 24px rgba(0,0,0,0.8)',
              }}
            >
              {currentDrill.name}
            </h1>
          ) : (
            <h1
              className="text-center leading-none tracking-wide"
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                color: '#3a1818',
                letterSpacing: '0.04em',
              }}
            >
              No Script Active
            </h1>
          )}
        </div>

        {/* ── 3. Timer ────────────────────────────────────────────────────── */}
        <div
          className="flex-1 min-h-0 flex items-center justify-center rounded-3xl"
          style={{
            backgroundColor: 'transparent',
            border: `3px solid ${color}`,
            boxShadow: `0 0 80px ${color}55, inset 0 0 60px ${color}11`,
            transition: 'border-color 0.6s, box-shadow 0.6s',
          }}
        >
          <span
            className="font-mono font-black leading-none select-none"
            style={{
              fontSize: 'clamp(5.5rem, 20vw, 13rem)',
              color,
              textShadow: `0 0 100px ${color}88`,
              transition: 'color 0.6s, text-shadow 0.6s',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {clockDisplay}
          </span>
        </div>

        {/* ── Progress bar ────────────────────────────────────────────────── */}
        <div className="shrink-0 w-full rounded-full overflow-hidden mt-2" style={{ height: 5, backgroundColor: '#1a0000' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, pct))}%`,
              backgroundColor: color,
              borderRadius: 9999,
              transition: 'width 0.95s linear, background-color 0.6s',
            }}
          />
        </div>

        {/* ── 4. Divider ──────────────────────────────────────────────────── */}
        <div className="shrink-0 mt-2 mb-2 w-full" style={{ height: 1, backgroundColor: '#1a0000' }} />

        {/* ── 5. Next up ──────────────────────────────────────────────────── */}
        <div className="shrink-0 flex flex-col items-center gap-0.5" style={{ minHeight: 56 }}>
          {nextDrill ? (
            <>
              <p
                className="tracking-widest uppercase font-bold"
                style={{ fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.25em' }}
              >
                Next Up
              </p>
              <p
                className="text-center leading-tight"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 'clamp(1.8rem, 4vw, 3.2rem)',
                  color: 'rgba(255,255,255,0.85)',
                  letterSpacing: '0.04em',
                }}
              >
                {nextDrill.name}
              </p>
              <p
                className="font-mono font-bold"
                style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.1rem)', color: '#9a8080' }}
              >
                {fmt(nextDrill.duration ?? 0)}
              </p>
            </>
          ) : activeScript && !isDone ? (
            <p
              className="tracking-widest uppercase font-bold"
              style={{ fontSize: '0.65rem', color: '#2a1010', letterSpacing: '0.16em' }}
            >
              Last Segment
            </p>
          ) : isDone ? (
            <p className="text-base font-black" style={{ color: '#22c55e' }}>
              ✓ Practice Complete!
            </p>
          ) : null}

          {inOverrun && (
            <p className="text-sm font-black animate-pulse mt-1" style={{ color: '#ef4444' }}>
              ⚠ OVERRUN — {fmt(overrunSecs)} past end
            </p>
          )}
        </div>

        {/* ── 6 & 7. Single control row: nav + start/next + time hot buttons ── */}
        <div className="shrink-0 flex items-center justify-center gap-2 pt-1 pb-0.5 flex-wrap">
          {/* Prev */}
          <button
            onClick={goPrev}
            disabled={drillIdx === 0}
            title="Previous segment"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl disabled:opacity-20 transition-opacity"
            style={{
              border:          '1px solid #2a0000',
              color:           '#9a8080',
              backgroundColor: backgroundUrl ? 'rgba(17,0,0,0.85)' : '#110000',
            }}
          >
            ⏮
          </button>

          {/* Reset */}
          <button
            onClick={resetAll}
            title="Reset"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-opacity"
            style={{
              border:          '1px solid #2a0000',
              color:           '#9a8080',
              backgroundColor: backgroundUrl ? 'rgba(17,0,0,0.85)' : '#110000',
            }}
          >
            ↺
          </button>

          {/* Start / Pause */}
          <button
            onClick={handleStart}
            className="h-11 px-8 rounded-xl font-black text-white transition-all"
            style={{ backgroundColor: orgColor, minWidth: 130, fontSize: '1.1rem' }}
          >
            {isRunning ? '⏸ Pause' : isDone ? '✓ Done' : '▶ Start'}
          </button>

          {/* Next → */}
          <button
            onClick={hornAndAdvance}
            disabled={isLastDrill && !isRunning && secondsLeft === 0}
            className="h-11 px-5 rounded-xl font-black transition-all disabled:opacity-30"
            style={{
              backgroundColor: backgroundUrl ? 'rgba(26,0,0,0.90)' : '#110000',
              border:          `2px solid ${orgColor}`,
              color:           orgColor,
              fontSize:        '1rem',
            }}
          >
            Next →
          </button>

          {/* Divider */}
          <div className="w-px h-7 mx-1" style={{ backgroundColor: '#2a0000' }} />

          {/* Time hot buttons — sm size */}
          {TIME_PRESETS.map(m => {
            const secs     = m * 60
            const isActive = secondsLeft === secs && !isRunning
            return (
              <button
                key={m}
                onClick={() => setTimeTo(secs)}
                className="h-11 px-2.5 rounded-lg text-xs font-bold"
                style={{
                  backgroundColor: isActive ? `${orgColor}22` : '#110000',
                  border:          `1px solid ${isActive ? orgColor : '#2a0000'}`,
                  color:           isActive ? orgColor : '#9a8080',
                }}
              >
                {m}m
              </button>
            )
          })}
          <button
            onClick={addMinute}
            className="h-11 px-2.5 rounded-lg text-xs font-bold"
            style={{ backgroundColor: '#110000', border: '1px solid #2a0000', color: '#9a8080' }}
          >
            +1m
          </button>
        </div>

        {/* ── 8. Coach toggles ─────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-center gap-3 pb-1 flex-wrap">
          <ToggleBtn
            label="Auto-Advance"
            active={autoAdvance}
            onColor={orgColor}
            onClick={toggleAutoAdvance}
          />
          <ToggleBtn
            label="Allow Overrun"
            active={allowOverrun}
            onColor="#ef4444"
            onClick={toggleAllowOverrun}
          />
          <ToggleBtn
            label="Air Horn"
            active={hornOnEnd}
            onColor={orgColor}
            onClick={toggleHornOnEnd}
          />
          <ToggleBtn
            label="Whistle 1:00"
            active={whistleAt60}
            onColor={orgColor}
            onClick={toggleWhistleAt60}
          />
        </div>

      </div>
    </div>
  )
}
