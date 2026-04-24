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

const PRESETS = [5, 10, 15, 20]

function Toggle({ label, value, onChange, orgColor }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
      style={{
        backgroundColor: value ? `${orgColor}22` : '#1a0000',
        border: `1px solid ${value ? orgColor : '#2a0000'}`,
        color: value ? orgColor : '#6a4040',
      }}
    >
      <span
        className="w-8 h-4 rounded-full relative transition-all flex-shrink-0"
        style={{ backgroundColor: value ? orgColor : '#2a0000' }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
          style={{ left: value ? '17px' : '2px' }}
        />
      </span>
      {label}
    </button>
  )
}

function CtrlBtn({ onClick, disabled, children, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold transition-opacity disabled:opacity-30"
      style={{ border: '1px solid #2a0000', color: '#9a8080', backgroundColor: '#110000' }}
    >
      {children}
    </button>
  )
}

export default function PracticeSection({ activeScript, orgColor }) {
  const drills = activeScript?.drills ?? []

  const [drillIdx, setDrillIdx]       = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isRunning, setIsRunning]     = useState(false)
  const [hasStarted, setHasStarted]   = useState(false)
  const [overrunSecs, setOverrunSecs] = useState(0)
  const [inOverrun, setInOverrun]     = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [allowOverrun, setAllowOverrun] = useState(false)
  const [manualDuration, setManualDuration] = useState(300)

  const idxRef          = useRef(0)
  const scriptRef       = useRef(activeScript)
  const totalRef        = useRef(0)
  const autoRef         = useRef(true)
  const overrunAllowRef = useRef(false)
  const inOverrunRef    = useRef(false)

  useEffect(() => { scriptRef.current = activeScript }, [activeScript])
  useEffect(() => { autoRef.current = autoAdvance }, [autoAdvance])
  useEffect(() => { overrunAllowRef.current = allowOverrun }, [allowOverrun])
  useEffect(() => { inOverrunRef.current = inOverrun }, [inOverrun])

  useEffect(() => { resetAll() }, [activeScript])

  function resetAll() {
    setIsRunning(false)
    setHasStarted(false)
    setInOverrun(false)
    inOverrunRef.current = false
    setOverrunSecs(0)
    setDrillIdx(0)
    idxRef.current = 0
    const dur = activeScript?.drills?.[0]?.duration ?? manualDuration
    setSecondsLeft(dur)
    totalRef.current = dur
  }

  function exitOverrun() {
    setInOverrun(false)
    inOverrunRef.current = false
    setOverrunSecs(0)
  }

  // Tick
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      if (inOverrunRef.current) {
        setOverrunSecs(s => s + 1)
        return
      }
      setSecondsLeft(prev => {
        if (prev <= 1) {
          const d = scriptRef.current?.drills ?? []
          const next = idxRef.current + 1
          if (overrunAllowRef.current) {
            inOverrunRef.current = true
            setInOverrun(true)
            setOverrunSecs(0)
            return 0
          }
          if (autoRef.current && next < d.length) {
            idxRef.current = next
            setDrillIdx(next)
            const dur = d[next].duration ?? 0
            totalRef.current = dur
            return dur
          }
          setIsRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning])

  function jumpTo(i) {
    exitOverrun()
    setIsRunning(false)
    idxRef.current = i
    setDrillIdx(i)
    const dur = drills[i]?.duration ?? manualDuration
    setSecondsLeft(dur)
    totalRef.current = dur
  }

  function goNext() {
    const next = drillIdx + 1
    if (next < drills.length) jumpTo(next)
  }

  function goPrev() {
    const prev = drillIdx - 1
    if (prev >= 0) jumpTo(prev)
  }

  function applyPreset(mins) {
    const dur = mins * 60
    setManualDuration(dur)
    exitOverrun()
    setIsRunning(false)
    setHasStarted(false)
    setSecondsLeft(dur)
    totalRef.current = dur
  }

  const currentDrill = drills[drillIdx]
  const nextDrill    = drills[drillIdx + 1]
  const pct          = totalRef.current ? (secondsLeft / totalRef.current) * 100 : 0
  const color        = inOverrun ? '#ef4444' : clockColor(secondsLeft, totalRef.current)
  const isDone       = hasStarted && !isRunning && secondsLeft === 0 && !inOverrun && drillIdx >= drills.length - 1
  const clockDisplay = inOverrun ? `+${fmt(overrunSecs)}` : fmt(secondsLeft)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-6 overflow-y-auto">

      {/* Script label + period dots */}
      {activeScript ? (
        <div className="flex flex-col items-center gap-2 w-full max-w-lg">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>
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
                    width:  i === drillIdx ? 12 : 8,
                    height: i === drillIdx ? 12 : 8,
                    backgroundColor: i < drillIdx ? orgColor : i === drillIdx ? orgColor : '#2a0000',
                    opacity: i < drillIdx ? 0.45 : 1,
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs font-semibold" style={{ color: '#9a8080' }}>
              {drillIdx + 1} / {drills.length}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center">
          <p className="font-bold text-white">Quick Timer</p>
          <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
            Select a script from the Scripts tab, or use a preset below.
          </p>
        </div>
      )}

      {/* Current drill */}
      {currentDrill && (
        <div
          className="w-full max-w-lg rounded-xl px-5 py-3 text-center transition-all"
          style={{ backgroundColor: '#150000', border: `1px solid ${color}44` }}
        >
          <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#9a8080' }}>
            Current Drill
          </p>
          <p className="text-xl md:text-2xl font-bold text-white leading-tight">{currentDrill.name}</p>
        </div>
      )}

      {/* Clock */}
      <div
        className="flex items-center justify-center rounded-2xl w-full max-w-xs"
        style={{
          aspectRatio: '2 / 1',
          backgroundColor: '#0d0000',
          border: `2px solid ${color}`,
          boxShadow: `0 0 60px ${color}33`,
          transition: 'border-color 0.6s, box-shadow 0.6s',
        }}
      >
        <span
          className="font-mono font-bold leading-none select-none"
          style={{
            fontSize: 'clamp(3rem, 13vw, 7rem)',
            color,
            textShadow: `0 0 48px ${color}55`,
            transition: 'color 0.6s, text-shadow 0.6s',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clockDisplay}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs rounded-full overflow-hidden" style={{ height: 4, backgroundColor: '#1a0000' }}>
        <div style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, pct))}%`,
          backgroundColor: color,
          borderRadius: 9999,
          transition: 'width 0.95s linear, background-color 0.6s',
        }} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <CtrlBtn onClick={goPrev} disabled={drillIdx === 0} title="Previous drill">⏮</CtrlBtn>
        <CtrlBtn onClick={resetAll} title="Reset">↺</CtrlBtn>

        <button
          onClick={() => { setIsRunning(r => !r); setHasStarted(true) }}
          className="px-8 h-12 rounded-xl font-bold text-white text-sm transition-opacity"
          style={{ backgroundColor: orgColor, minWidth: 128 }}
        >
          {isRunning ? '⏸ Pause' : isDone ? '✓ Done' : '▶ Start'}
        </button>

        <CtrlBtn onClick={goNext} disabled={drillIdx >= drills.length - 1 && !inOverrun} title="Next drill">⏭</CtrlBtn>
      </div>

      {/* Next drill */}
      {nextDrill && (
        <div
          className="w-full max-w-lg rounded-xl px-5 py-3 flex items-center justify-between gap-4"
          style={{ backgroundColor: '#0d0000', border: '1px solid #2a0000' }}
        >
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#4a2020' }}>Next Up</p>
            <p className="text-base font-semibold text-white truncate">{nextDrill.name}</p>
          </div>
          <p className="text-sm font-mono font-bold shrink-0" style={{ color: '#6a4040' }}>
            {fmt(nextDrill.duration ?? 0)}
          </p>
        </div>
      )}

      {inOverrun && (
        <p className="text-xs font-bold animate-pulse" style={{ color: '#ef4444' }}>
          ⚠ OVERRUN — {fmt(overrunSecs)} past end · press Next or Reset
        </p>
      )}
      {isDone && (
        <p className="text-sm font-bold" style={{ color: '#22c55e' }}>✓ Practice complete!</p>
      )}

      {/* Presets + toggles */}
      <div className="w-full max-w-lg flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid #1a0000' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest shrink-0" style={{ color: '#4a2020' }}>
            {activeScript ? 'Override' : 'Preset'}
          </span>
          {PRESETS.map(m => (
            <button
              key={m}
              onClick={() => applyPreset(m)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: !activeScript && secondsLeft === m * 60 ? `${orgColor}22` : '#1a0000',
                border: `1px solid ${!activeScript && secondsLeft === m * 60 ? orgColor : '#2a0000'}`,
                color: !activeScript && secondsLeft === m * 60 ? orgColor : '#9a8080',
              }}
            >
              {m}m
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Toggle label="Auto-advance" value={autoAdvance} onChange={setAutoAdvance} orgColor={orgColor} />
          <Toggle label="Allow Overrun" value={allowOverrun} onChange={setAllowOverrun} orgColor={orgColor} />
        </div>
      </div>
    </div>
  )
}
