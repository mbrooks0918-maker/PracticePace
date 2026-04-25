import { useState, useEffect, useRef } from 'react'

function pad(n) { return String(n).padStart(2, '0') }
function fmt(s) { return `${pad(Math.floor(Math.abs(s) / 60))}:${pad(Math.abs(s) % 60)}` }

function clockColor(left, total) {
  if (!total || total <= 0) return '#22c55e'
  const pct = left / total
  if (pct > 0.6) return '#22c55e'
  if (pct > 0.3) return '#f59e0b'
  return '#ef4444'
}

// ── Airhorn ───────────────────────────────────────────────────────────────────
let _audioCtx = null
let _hornBuffer = null

async function loadHorn() {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (_audioCtx.state === 'suspended') await _audioCtx.resume()
    if (_hornBuffer) return
    const res = await fetch('/airhorn.mp3')
    const ab  = await res.arrayBuffer()
    _hornBuffer = await _audioCtx.decodeAudioData(ab)
  } catch (e) { /* ignore */ }
}

function blowHorn() {
  try {
    if (!_audioCtx || !_hornBuffer) { loadHorn(); return }
    if (_audioCtx.state === 'suspended') _audioCtx.resume()
    const src  = _audioCtx.createBufferSource()
    const gain = _audioCtx.createGain()
    gain.gain.value = 4.0
    src.buffer = _hornBuffer
    src.connect(gain)
    gain.connect(_audioCtx.destination)
    src.start(0)
  } catch (e) { /* ignore */ }
}

const PRESETS = [5, 10, 15, 20]

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PracticeSection({ activeScript, orgColor, backgroundUrl }) {
  const drills = activeScript?.drills ?? []

  const [drillIdx,    setDrillIdx]    = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isRunning,   setIsRunning]   = useState(false)
  const [hasStarted,  setHasStarted]  = useState(false)
  const [overrunSecs, setOverrunSecs] = useState(0)
  const [inOverrun,   setInOverrun]   = useState(false)
  const [manualDuration, setManualDuration] = useState(300)

  const idxRef       = useRef(0)
  const scriptRef    = useRef(activeScript)
  const totalRef     = useRef(0)
  const inOverrunRef = useRef(false)
  const hornFiredRef = useRef(false)

  useEffect(() => { scriptRef.current = activeScript }, [activeScript])
  useEffect(() => { inOverrunRef.current = inOverrun }, [inOverrun])
  useEffect(() => { resetAll() }, [activeScript])

  function resetAll() {
    setIsRunning(false); setHasStarted(false)
    setInOverrun(false); inOverrunRef.current = false
    setOverrunSecs(0); setDrillIdx(0); idxRef.current = 0
    hornFiredRef.current = false
    const dur = activeScript?.drills?.[0]?.duration ?? manualDuration
    setSecondsLeft(dur); totalRef.current = dur
  }

  // Tick — auto-advance is always on
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      if (inOverrunRef.current) { setOverrunSecs(s => s + 1); return }
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (!hornFiredRef.current) { hornFiredRef.current = true; blowHorn() }
          const d    = scriptRef.current?.drills ?? []
          const next = idxRef.current + 1
          if (next < d.length) {
            hornFiredRef.current = false
            idxRef.current = next; setDrillIdx(next)
            const dur = d[next].duration ?? 0; totalRef.current = dur; return dur
          }
          setIsRunning(false); return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning])

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
    if (next < drills.length) {
      jumpTo(next)
    } else {
      setIsRunning(false)
    }
  }

  function applyPreset(mins) {
    const dur = mins * 60; setManualDuration(dur)
    setInOverrun(false); inOverrunRef.current = false
    setIsRunning(false); setHasStarted(false)
    setSecondsLeft(dur); totalRef.current = dur; hornFiredRef.current = false
  }

  function handleStart() {
    loadHorn()
    setIsRunning(r => !r); setHasStarted(true)
  }

  const currentDrill  = drills[drillIdx]
  const nextDrill     = drills[drillIdx + 1]
  const pct           = totalRef.current ? (secondsLeft / totalRef.current) * 100 : 0
  const color         = inOverrun ? '#ef4444' : clockColor(secondsLeft, totalRef.current)
  const isDone        = hasStarted && !isRunning && secondsLeft === 0 && !inOverrun && drillIdx >= drills.length - 1
  const clockDisplay  = inOverrun ? `+${fmt(overrunSecs)}` : fmt(secondsLeft)
  const isLastDrill   = drillIdx >= drills.length - 1

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden relative"
      style={{
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay when background image is set */}
      {backgroundUrl && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: 'rgba(0,0,0,0.72)' }} />
      )}

      {/* All content above the overlay */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">

        {/* ── Top strip: script name + dots ── */}
        <div className="shrink-0 flex flex-col items-center gap-1.5 pt-2 pb-1 px-4">
          {activeScript ? (
            <>
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>
                {activeScript.name}
              </p>
              {drills.length <= 30 ? (
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {drills.map((_, i) => (
                    <button key={i} onClick={() => jumpTo(i)} title={drills[i].name}
                      className="rounded-full transition-all"
                      style={{
                        width:  i === drillIdx ? 12 : 8,
                        height: i === drillIdx ? 12 : 8,
                        backgroundColor: i <= drillIdx ? orgColor : '#2a0000',
                        opacity: i < drillIdx ? 0.4 : 1,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs font-semibold" style={{ color: '#9a8080' }}>
                  {drillIdx + 1} / {drills.length}
                </p>
              )}
            </>
          ) : (
            <div className="text-center">
              <p className="font-bold text-white text-sm">Quick Timer</p>
              <p className="text-xs" style={{ color: '#9a8080' }}>Go to Scripts and tap Set Active to load a script.</p>
            </div>
          )}
        </div>

        {/* ── Main 3-column layout ── */}
        <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-3 px-3 pb-2 min-h-0 overflow-hidden">

          {/* LEFT — Current Drill */}
          <div className="md:w-56 lg:w-64 shrink-0 flex items-stretch">
            {currentDrill ? (
              <div className="flex-1 rounded-2xl p-4 md:p-5 flex flex-col justify-center gap-3"
                style={{ backgroundColor: backgroundUrl ? 'rgba(17,0,0,0.85)' : '#110000', border: `2px solid ${color}55` }}>
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#9a8080' }}>
                  NOW
                </p>
                <p className="font-black text-white leading-tight"
                  style={{ fontSize: 'clamp(1.4rem, 3.2vw, 2.6rem)' }}>
                  {currentDrill.name}
                </p>
                <p className="font-mono font-bold" style={{ color, fontSize: 'clamp(1.1rem, 2vw, 1.5rem)' }}>
                  {fmt(currentDrill.duration ?? 0)}
                </p>
              </div>
            ) : (
              <div className="flex-1 rounded-2xl p-6 flex items-center justify-center"
                style={{ backgroundColor: backgroundUrl ? 'rgba(17,0,0,0.85)' : '#110000', border: '1px solid #1a0000' }}>
                <p className="text-sm text-center" style={{ color: '#4a2020' }}>
                  No script active
                </p>
              </div>
            )}
          </div>

          {/* CENTER — Clock + controls */}
          <div className="flex-1 min-w-0 flex flex-col items-center justify-between gap-2 min-h-0">

            {/* Clock face */}
            <div className="w-full flex-1 flex items-center justify-center rounded-3xl min-h-0"
              style={{
                backgroundColor: backgroundUrl ? 'rgba(13,0,0,0.80)' : '#0d0000',
                border: `3px solid ${color}`,
                boxShadow: `0 0 120px ${color}44`,
                transition: 'border-color 0.6s, box-shadow 0.6s',
              }}
            >
              <span className="font-mono font-black leading-none select-none"
                style={{
                  fontSize: 'clamp(4rem, 16vw, 11rem)',
                  color,
                  textShadow: `0 0 80px ${color}66`,
                  transition: 'color 0.6s, text-shadow 0.6s',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {clockDisplay}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full rounded-full overflow-hidden shrink-0" style={{ height: 7, backgroundColor: '#1a0000' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, pct))}%`,
                backgroundColor: color,
                borderRadius: 9999,
                transition: 'width 0.95s linear, background-color 0.6s',
              }} />
            </div>

            {/* Status messages */}
            <div className="shrink-0 h-6 flex items-center justify-center">
              {inOverrun && (
                <p className="text-sm font-black animate-pulse" style={{ color: '#ef4444' }}>
                  ⚠ OVERRUN — {fmt(overrunSecs)} past end
                </p>
              )}
              {isDone && (
                <p className="text-base font-black" style={{ color: '#22c55e' }}>✓ Practice complete!</p>
              )}
            </div>

            {/* Control row */}
            <div className="shrink-0 flex items-center gap-3 flex-wrap justify-center">
              {/* Prev */}
              <button onClick={goPrev} disabled={drillIdx === 0} title="Previous drill"
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold disabled:opacity-20 transition-opacity"
                style={{ border: '1px solid #2a0000', color: '#9a8080', backgroundColor: backgroundUrl ? 'rgba(17,0,0,0.85)' : '#110000' }}>
                ⏮
              </button>

              {/* Reset */}
              <button onClick={resetAll} title="Reset practice"
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-opacity"
                style={{ border: '1px solid #2a0000', color: '#9a8080', backgroundColor: backgroundUrl ? 'rgba(17,0,0,0.85)' : '#110000' }}>
                ↺
              </button>

              {/* Start / Pause */}
              <button onClick={handleStart}
                className="h-16 px-10 rounded-xl font-black text-white transition-all"
                style={{ backgroundColor: orgColor, minWidth: 160, fontSize: '1.25rem' }}>
                {isRunning ? '⏸ Pause' : isDone ? '✓ Done' : '▶ Start'}
              </button>

              {/* Horn + Next */}
              <button
                onClick={hornAndAdvance}
                disabled={isLastDrill && !isRunning && secondsLeft === 0}
                className="h-16 px-8 rounded-xl font-black transition-all disabled:opacity-30"
                style={{
                  backgroundColor: backgroundUrl ? 'rgba(26,0,0,0.90)' : '#1a0000',
                  border: `2px solid ${orgColor}`,
                  color: orgColor,
                  fontSize: '1.15rem',
                  letterSpacing: '0.03em',
                }}
              >
                📯 Next
              </button>
            </div>

            {/* Preset row — Quick Timer only */}
            {!activeScript && (
              <div className="shrink-0 flex items-center gap-2 pb-1">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a2020' }}>Preset</span>
                {PRESETS.map(m => (
                  <button key={m} onClick={() => applyPreset(m)}
                    className="px-4 py-2 rounded-lg text-sm font-bold"
                    style={{
                      backgroundColor: secondsLeft === m * 60 ? `${orgColor}22` : '#1a0000',
                      border: `1px solid ${secondsLeft === m * 60 ? orgColor : '#2a0000'}`,
                      color: secondsLeft === m * 60 ? orgColor : '#9a8080',
                    }}>
                    {m}m
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Next Up */}
          <div className="md:w-56 lg:w-64 shrink-0 flex items-stretch">
            {nextDrill ? (
              <div className="flex-1 rounded-2xl p-4 md:p-5 flex flex-col justify-center gap-3"
                style={{ backgroundColor: backgroundUrl ? 'rgba(13,0,0,0.85)' : '#0d0000', border: '2px solid #2a0000' }}>
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#4a2020' }}>
                  NEXT
                </p>
                <p className="font-black text-white leading-tight"
                  style={{ fontSize: 'clamp(1.4rem, 3.2vw, 2.6rem)' }}>
                  {nextDrill.name}
                </p>
                <p className="font-mono font-bold" style={{ color: '#6a4040', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)' }}>
                  {fmt(nextDrill.duration ?? 0)}
                </p>
              </div>
            ) : activeScript ? (
              <div className="flex-1 rounded-2xl p-6 flex items-center justify-center"
                style={{ backgroundColor: backgroundUrl ? 'rgba(13,0,0,0.85)' : '#0d0000', border: '1px solid #1a0000' }}>
                <p className="text-sm font-semibold" style={{ color: '#4a2020' }}>Last segment</p>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 rounded-2xl"
                style={{ backgroundColor: backgroundUrl ? 'rgba(13,0,0,0.85)' : '#0d0000', border: '1px solid #1a0000' }} />
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
