import { useState, useEffect, useRef } from 'react'

function pad(n) { return String(n).padStart(2, '0') }
function fmtClock(s) { return `${pad(Math.floor(Math.abs(s) / 60))}:${pad(Math.abs(s) % 60)}` }

// Parse "MM:SS" or "M:SS" typed input → seconds
function parseTimeInput(str) {
  const parts = str.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (!isNaN(m) && !isNaN(s) && s < 60) return m * 60 + s
  }
  const n = parseInt(str, 10)
  if (!isNaN(n)) return n
  return null
}

// ── Shared components ─────────────────────────────────────────────────────────

function Btn({ onClick, children, active, orgColor, danger, sm }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl font-bold transition-all ${sm ? 'px-3 py-2 text-xs' : 'px-5 py-3 text-sm'}`}
      style={{
        backgroundColor: danger ? '#cc1111' : active ? orgColor : '#1a0000',
        border:          `1px solid ${danger ? '#cc1111' : active ? orgColor : '#2a0000'}`,
        color:           (active || danger) ? '#fff' : '#9a8080',
      }}
    >
      {children}
    </button>
  )
}

// Large game clock — tappable to edit when paused
function GameClock({ secs, warn, running, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const inputRef              = useRef(null)

  function startEdit() {
    if (running) return
    setDraft(fmtClock(secs))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 10)
  }

  function commitEdit() {
    const parsed = parseTimeInput(draft)
    if (parsed !== null && parsed >= 0) onChange(parsed)
    setEditing(false)
    setDraft('')
  }

  function handleKey(e) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') { setEditing(false); setDraft('') }
  }

  const color = warn ? '#ef4444' : '#ffffff'

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKey}
        className="font-mono font-black text-center rounded-xl px-3 outline-none"
        style={{
          fontSize: 'clamp(3.75rem, 12.5vw, 8.75rem)',
          color,
          backgroundColor: '#1a0000',
          border:          `2px solid ${color}`,
          fontVariantNumeric: 'tabular-nums',
          width: 'clamp(260px, 36vw, 500px)',
        }}
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      title={running ? undefined : 'Tap to set time'}
      className="font-mono font-black leading-none transition-opacity"
      style={{
        fontSize:           'clamp(3.75rem, 12.5vw, 8.75rem)',
        color,
        fontVariantNumeric: 'tabular-nums',
        cursor:             running ? 'default' : 'text',
        opacity:            1,
      }}
    >
      {fmtClock(secs)}
    </button>
  )
}

// Small clock for play/shot clock — with inline +/- adjust
function AdjustableClock({ secs, warn, onAdjust }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onAdjust(-1)}
        className="w-8 h-8 rounded-lg text-base font-bold flex items-center justify-center"
        style={{ border: '1px solid #2a0000', color: '#9a8080' }}
      >
        −
      </button>
      <span
        className="font-mono font-black min-w-[3ch] text-center"
        style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', color: warn ? '#ef4444' : '#fff', fontVariantNumeric: 'tabular-nums' }}
      >
        {pad(secs)}
      </span>
      <button
        onClick={() => onAdjust(+1)}
        className="w-8 h-8 rounded-lg text-base font-bold flex items-center justify-center"
        style={{ border: '1px solid #2a0000', color: '#9a8080' }}
      >
        +
      </button>
    </div>
  )
}

function PlusMinusRow({ label, value, onChange, min = 0, max = 999 }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-widest shrink-0" style={{ color: '#4a2020' }}>{label}</span>
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 rounded-lg text-base font-bold" style={{ border: '1px solid #2a0000', color: '#9a8080' }}>−</button>
      <span className="text-white font-bold text-base w-8 text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))}
        className="w-9 h-9 rounded-lg text-base font-bold" style={{ border: '1px solid #2a0000', color: '#9a8080' }}>+</button>
    </div>
  )
}

// ── Football ──────────────────────────────────────────────────────────────────

const QUARTERS = ['Q1','Q2','Q3','Q4','OT']
const DOWNS    = ['1st','2nd','3rd','4th']

function FootballScoreboard({ orgColor }) {
  const [home, setHome] = useState({ name: 'HOME', score: 0, timeouts: 3 })
  const [away, setAway] = useState({ name: 'AWAY', score: 0, timeouts: 3 })
  const [quarter, setQuarter]     = useState(0)
  const [down, setDown]           = useState(0)
  const [distance, setDistance]   = useState(10)
  const [ballOn, setBallOn]       = useState(25)
  const [gameSecs, setGameSecs]   = useState(15 * 60)
  const [gameRun, setGameRun]     = useState(false)
  const [playSecs, setPlaySecs]   = useState(40)
  const [playRun, setPlayRun]     = useState(false)
  const [playPreset, setPlayPreset] = useState(40)

  useEffect(() => {
    if (!gameRun) return
    const id = setInterval(() => setGameSecs(s => { if (s <= 0) { setGameRun(false); return 0 } return s - 1 }), 1000)
    return () => clearInterval(id)
  }, [gameRun])

  useEffect(() => {
    if (!playRun) return
    const id = setInterval(() => setPlaySecs(s => { if (s <= 0) { setPlayRun(false); return 0 } return s - 1 }), 1000)
    return () => clearInterval(id)
  }, [playRun])

  function resetPlay(preset = playPreset) { setPlayRun(false); setPlaySecs(preset); setPlayPreset(preset) }
  function score(setTeam, pts) { setTeam(t => ({ ...t, score: Math.max(0, t.score + pts) })) }

  const ScoreButtons = ({ setTeam }) => (
    <div className="flex flex-wrap gap-2 justify-center">
      {[7, 6, 3, 2, 1].map(p => (
        <button key={p} onClick={() => score(setTeam, p)}
          className="w-12 h-12 rounded-xl text-sm font-black"
          style={{ backgroundColor: `${orgColor}22`, border: `1px solid ${orgColor}`, color: orgColor }}>
          +{p}
        </button>
      ))}
      <button onClick={() => score(setTeam, -1)}
        className="w-12 h-12 rounded-xl text-sm font-black"
        style={{ backgroundColor: '#1a0000', border: '1px solid #3a0000', color: '#9a8080' }}>
        -1
      </button>
    </div>
  )

  const TimeoutDots = ({ team, setTeam }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-widest" style={{ color: '#4a2020' }}>TO</span>
      {[0,1,2].map(i => (
        <button key={i}
          onClick={() => setTeam(t => ({ ...t, timeouts: i < t.timeouts ? Math.max(0, t.timeouts - 1) : Math.min(3, t.timeouts + 1) }))}
          className="w-5 h-5 rounded-full transition-all"
          style={{ backgroundColor: i < team.timeouts ? orgColor : '#2a0000' }}
        />
      ))}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col gap-3 p-4 overflow-hidden min-h-0">

      {/* Row 1: Game clock — centered at top */}
      <div className="shrink-0 flex flex-col gap-3 rounded-2xl px-6 py-4"
        style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>

        {/* Clock — centered, full width */}
        <div className="flex flex-col items-center gap-1">
          <GameClock secs={gameSecs} warn={gameSecs <= 60} running={gameRun} onChange={setGameSecs} />
          {!gameRun && (
            <span className="text-xs" style={{ color: '#6a4040' }}>tap clock to set time</span>
          )}
        </div>

        {/* Controls row: quarter left · presets center · Start/Reset right */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <select
            value={quarter}
            onChange={e => { setQuarter(Number(e.target.value)); setGameSecs(15*60); setGameRun(false) }}
            className="rounded-xl px-4 py-3 text-sm font-bold outline-none shrink-0"
            style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }}
          >
            {QUARTERS.map((l,i) => <option key={l} value={i}>{l}</option>)}
          </select>

          <div className="flex items-center gap-2 flex-wrap justify-center flex-1">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#4a2020' }}>Set Clock</span>
            {[[15,0],[10,0],[5,0],[2,0],[1,0],[0,30]].map(([m,s]) => (
              <button
                key={`${m}:${s}`}
                onClick={() => { setGameRun(false); setGameSecs(m*60+s) }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#9a8080' }}
              >
                {m}:{pad(s)}
              </button>
            ))}
          </div>

          <div className="flex gap-2 shrink-0">
            <button onClick={() => setGameRun(r => !r)}
              className="px-8 py-3 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: orgColor }}>
              {gameRun ? '⏸ Pause' : '▶ Start'}
            </button>
            <button onClick={() => { setGameRun(false); setGameSecs(15*60) }}
              className="px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ border: '1px solid #2a0000', color: '#9a8080' }}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Teams */}
      <div className="flex-1 flex gap-3 min-h-0">
        {[[home, setHome, 'HOME'], [away, setAway, 'AWAY']].map(([team, setTeam, side], idx) => (
          <div key={side} className="flex-1 flex flex-col items-center justify-around gap-3 rounded-2xl p-4"
            style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <input
              value={team.name}
              onChange={e => setTeam(t => ({ ...t, name: e.target.value }))}
              className="text-center text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2.5 w-full outline-none"
              style={{ backgroundColor: 'transparent', border: '1px solid #2a0000', color: '#9a8080' }}
              maxLength={20}
            />
            <div className="font-black text-white select-none"
              style={{ fontSize: 'clamp(5rem, 16vw, 9rem)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {team.score}
            </div>
            <ScoreButtons setTeam={setTeam} />
            <TimeoutDots team={team} setTeam={setTeam} />
          </div>
        ))}
      </div>

      {/* Row 3: Situation + play clock */}
      <div className="shrink-0 flex items-center gap-4 flex-wrap rounded-2xl px-6 py-4"
        style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: '#4a2020' }}>Down</span>
          {DOWNS.map((d,i) => (
            <button key={d} onClick={() => setDown(i)}
              className="w-12 h-10 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: down===i ? orgColor : '#1a0000',
                border:          `1px solid ${down===i ? orgColor : '#2a0000'}`,
                color:           down===i ? '#fff' : '#9a8080',
              }}>
              {d}
            </button>
          ))}
        </div>
        <PlusMinusRow label="& (yds)" value={distance} onChange={setDistance} min={1} max={99} />
        <PlusMinusRow label="Ball on" value={ballOn}   onChange={setBallOn}   min={1} max={99} />

        {/* Play clock */}
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <span className="text-xs uppercase tracking-widest" style={{ color: '#4a2020' }}>Play Clock</span>
          <AdjustableClock
            secs={playSecs}
            warn={playSecs <= 5}
            onAdjust={d => { setPlayRun(false); setPlaySecs(s => Math.max(0, Math.min(60, s + d))) }}
          />
          <div className="flex gap-2">
            {[40, 25].map(p => (
              <Btn key={p} onClick={() => resetPlay(p)} active={playPreset===p} orgColor={orgColor} sm>{p}s</Btn>
            ))}
            <Btn onClick={() => resetPlay(playPreset)} sm>Reset</Btn>
            <button
              onClick={() => setPlayRun(r => !r)}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: orgColor }}
            >
              {playRun ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Basketball ────────────────────────────────────────────────────────────────

const PERIODS_Q = ['Q1','Q2','Q3','Q4','OT']
const PERIODS_H = ['H1','H2','OT']

const SHOT_AMBER = '#f59e0b'

function BasketballScoreboard({ orgColor }) {
  const [home, setHome] = useState({ name: 'HOME', score: 0, fouls: 0 })
  const [away, setAway] = useState({ name: 'AWAY', score: 0, fouls: 0 })
  const [period, setPeriod]         = useState(0)
  const [periodType, setPeriodType] = useState('quarters')
  const [possession, setPossession] = useState(null)
  const [gameSecs, setGameSecs]     = useState(10 * 60)
  const [gameRun, setGameRun]       = useState(false)
  const [shotSecs, setShotSecs]     = useState(35)
  const [shotRun, setShotRun]       = useState(false)
  const [shotPreset, setShotPreset] = useState(35)

  const pLabels = periodType === 'halves' ? PERIODS_H : PERIODS_Q
  const pDur    = periodType === 'halves' ? 20 * 60  : 10 * 60

  useEffect(() => {
    if (!gameRun) return
    const id = setInterval(() => setGameSecs(s => { if (s<=0){setGameRun(false);return 0} return s-1 }), 1000)
    return () => clearInterval(id)
  }, [gameRun])

  useEffect(() => {
    if (!shotRun) return
    const id = setInterval(() => setShotSecs(s => { if (s<=0){setShotRun(false);return 0} return s-1 }), 1000)
    return () => clearInterval(id)
  }, [shotRun])

  function resetShot(p = shotPreset) { setShotRun(false); setShotSecs(p); setShotPreset(p) }
  function adj(setTeam, pts) { setTeam(t => ({ ...t, score: Math.max(0, t.score + pts) })) }

  // ── Sub-components ───────────────────────────────────────────────────────────
  const ScoreButtons = ({ setTeam }) => (
    <div className="flex gap-2 w-full">
      {[
        { pts: 1, label: 'FT' },
        { pts: 2, label: '2pt' },
        { pts: 3, label: '3pt' },
      ].map(({ pts, label }) => (
        <button
          key={pts}
          onClick={() => adj(setTeam, pts)}
          className="flex-1 flex flex-col items-center justify-center rounded-xl font-black py-3"
          style={{
            backgroundColor: `${orgColor}22`,
            border:          `2px solid ${orgColor}`,
            color:            orgColor,
          }}
        >
          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>+{pts}</span>
          <span style={{ fontSize: '0.65rem', lineHeight: 1.4, color: `${orgColor}99` }}>{label}</span>
        </button>
      ))}
      <button
        onClick={() => adj(setTeam, -1)}
        className="flex items-center justify-center rounded-xl font-bold px-3"
        style={{ backgroundColor:'#1a0000', border:'1px solid #3a0000', color:'#6a4040', fontSize: '0.85rem' }}
      >
        -1
      </button>
    </div>
  )

  const FoulCounter = ({ team, setTeam }) => {
    const bonus = team.fouls >= 7
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setTeam(t => ({ ...t, fouls: Math.max(0, t.fouls-1) }))}
          className="w-8 h-8 rounded-lg text-sm font-bold" style={{ border:'1px solid #2a0000', color:'#9a8080' }}>−</button>
        <div className="text-center" style={{ minWidth: 48 }}>
          <div className="font-black text-base" style={{ color: bonus ? SHOT_AMBER : '#fff', fontVariantNumeric:'tabular-nums' }}>{team.fouls}</div>
          <div className="text-xs font-bold" style={{ color: bonus ? SHOT_AMBER : '#4a2020' }}>{bonus ? 'BONUS' : 'FOULS'}</div>
        </div>
        <button onClick={() => setTeam(t => ({ ...t, fouls: t.fouls+1 }))}
          className="w-8 h-8 rounded-lg text-sm font-bold" style={{ border:'1px solid #2a0000', color:'#9a8080' }}>+</button>
      </div>
    )
  }

  const shotWarn = shotSecs <= 5

  // ── Layout ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col gap-2 p-3 overflow-hidden min-h-0">

      {/* ── ROW 1: Shot clock LEFT | Game clock CENTER | Period controls RIGHT ── */}
      <div className="shrink-0 flex gap-3 items-stretch">

        {/* Shot clock box — left */}
        <div className="flex flex-col items-center justify-between rounded-2xl px-4 py-3 shrink-0"
          style={{
            backgroundColor: '#0d0800',
            border: `2px solid ${shotWarn ? '#ef4444' : SHOT_AMBER}44`,
            boxShadow: shotWarn ? '0 0 16px #ef444433' : `0 0 16px ${SHOT_AMBER}22`,
            minWidth: 160,
          }}>
          {/* Label */}
          <span className="text-xs font-bold uppercase tracking-widest"
            style={{ color: shotWarn ? '#ef4444' : `${SHOT_AMBER}99` }}>
            Shot Clock
          </span>

          {/* Large amber number */}
          <div
            className="font-black font-mono leading-none"
            style={{
              fontSize: 'clamp(3rem, 8vw, 4.5rem)',
              color: shotWarn ? '#ef4444' : SHOT_AMBER,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {pad(shotSecs)}
          </div>

          {/* +/- nudge */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setShotRun(false); setShotSecs(s => Math.max(0, s - 1)) }}
              className="w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center"
              style={{ border: '1px solid #3a2000', color: `${SHOT_AMBER}88` }}>−</button>
            <button onClick={() => { setShotRun(false); setShotSecs(s => Math.min(35, s + 1)) }}
              className="w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center"
              style={{ border: '1px solid #3a2000', color: `${SHOT_AMBER}88` }}>+</button>
          </div>

          {/* Preset + play buttons */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {[35, 24, 14].map(p => (
              <button key={p} onClick={() => resetShot(p)}
                className="px-2 py-1 rounded-lg text-xs font-bold transition-all"
                style={{
                  backgroundColor: shotPreset === p ? `${SHOT_AMBER}22` : '#1a0d00',
                  border:          `1px solid ${shotPreset === p ? SHOT_AMBER : '#3a2000'}`,
                  color:           shotPreset === p ? SHOT_AMBER : `${SHOT_AMBER}55`,
                }}>
                {p}s
              </button>
            ))}
            <button onClick={() => resetShot(shotPreset)}
              className="px-2 py-1 rounded-lg text-xs font-bold"
              style={{ border: '1px solid #3a2000', color: `${SHOT_AMBER}55` }}>
              Rst
            </button>
          </div>

          {/* Play/Pause */}
          <button
            onClick={() => setShotRun(r => !r)}
            className="w-full py-2 rounded-xl text-sm font-bold"
            style={{ backgroundColor: shotWarn ? '#ef444422' : `${SHOT_AMBER}22`,
              border: `1px solid ${shotWarn ? '#ef4444' : SHOT_AMBER}`,
              color: shotWarn ? '#ef4444' : SHOT_AMBER }}
          >
            {shotRun ? '⏸ Pause' : '▶ Start'}
          </button>
        </div>

        {/* Game clock — center, dominant */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-3"
          style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
          <GameClock secs={gameSecs} warn={gameSecs <= 60} running={gameRun} onChange={setGameSecs} />
          {!gameRun && (
            <span className="text-xs" style={{ color: '#6a4040' }}>tap to set time</span>
          )}
        </div>

        {/* Period controls — right */}
        <div className="flex flex-col items-center justify-between gap-2 rounded-2xl px-4 py-3 shrink-0"
          style={{ backgroundColor: '#110000', border: '1px solid #2a0000', minWidth: 160 }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#9a8080' }}>
            Period
          </span>

          {/* Quarters / Halves toggle */}
          <div className="flex gap-1.5">
            {['quarters','halves'].map(t => (
              <button key={t}
                onClick={() => { setPeriodType(t); setPeriod(0); setGameSecs(t==='halves'?20*60:10*60); setGameRun(false) }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  backgroundColor: periodType===t ? `${orgColor}22` : '#1a0000',
                  border:          `1px solid ${periodType===t ? orgColor : '#2a0000'}`,
                  color:           periodType===t ? orgColor : '#9a8080',
                }}>
                {t === 'quarters' ? 'Qtrs' : 'Halves'}
              </button>
            ))}
          </div>

          {/* Period selector */}
          <select
            value={period}
            onChange={e => { setPeriod(Number(e.target.value)); setGameSecs(pDur); setGameRun(false) }}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-bold outline-none text-center"
            style={{ backgroundColor:'#1a0000', border:'1px solid #2a0000', color:'#fff' }}
          >
            {pLabels.map((l,i) => <option key={l} value={i}>{l}</option>)}
          </select>

          {/* Possession indicator */}
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#4a2020' }}>Ball</span>
            <button onClick={() => setPossession(p => p==='home' ? null : 'home')}
              className="px-2 py-1 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: possession==='home' ? `${orgColor}22` : '#1a0000',
                border: `1px solid ${possession==='home' ? orgColor : '#2a0000'}`,
                color:  possession==='home' ? orgColor : '#4a2020',
              }}>
              {home.name || 'HOME'}
            </button>
            <button onClick={() => setPossession(p => p==='away' ? null : 'away')}
              className="px-2 py-1 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: possession==='away' ? `${orgColor}22` : '#1a0000',
                border: `1px solid ${possession==='away' ? orgColor : '#2a0000'}`,
                color:  possession==='away' ? orgColor : '#4a2020',
              }}>
              {away.name || 'AWAY'}
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Score panels ── */}
      <div className="flex-1 flex gap-3 min-h-0">
        {[['home', home, setHome], ['away', away, setAway]].map(([side, team, setTeam]) => (
          <div key={side} className="flex-1 flex flex-col rounded-2xl p-4 overflow-hidden"
            style={{ backgroundColor:'#110000', border:'1px solid #2a0000' }}>

            {/* Team name */}
            <input
              value={team.name}
              onChange={e => setTeam(t => ({ ...t, name: e.target.value }))}
              className="shrink-0 text-center text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2 outline-none w-full"
              style={{ backgroundColor:'transparent', border:'1px solid #2a0000', color:'#9a8080' }}
              maxLength={20}
            />

            {/* Score number — flex-1 center */}
            <div className="flex-1 flex items-center justify-center">
              <div className="font-black text-white select-none"
                style={{ fontSize:'clamp(5rem,16vw,9rem)', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
                {team.score}
              </div>
            </div>

            {/* Score buttons — pinned bottom */}
            <div className="shrink-0 flex flex-col gap-2">
              <ScoreButtons setTeam={setTeam} />
              <div className="flex justify-center">
                <FoulCounter team={team} setTeam={setTeam} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── ROW 3: Clock presets + Start/Reset ── */}
      <div className="shrink-0 flex items-center gap-3 flex-wrap rounded-2xl px-5 py-3"
        style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
        <span className="text-xs uppercase tracking-widest shrink-0" style={{ color: '#4a2020' }}>Set Clock</span>
        <div className="flex gap-2 flex-wrap flex-1">
          {[[10,0],[5,0],[2,0],[1,0],[0,30]].map(([m,s]) => (
            <button key={`${m}:${s}`}
              onClick={() => { setGameRun(false); setGameSecs(m*60+s) }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#9a8080' }}>
              {m}:{pad(s)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setGameRun(r => !r)}
            className="px-7 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: orgColor }}>
            {gameRun ? '⏸ Pause' : '▶ Start'}
          </button>
          <button onClick={() => { setGameRun(false); setGameSecs(pDur) }}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ border:'1px solid #2a0000', color:'#9a8080' }}>
            Reset
          </button>
        </div>
      </div>

    </div>
  )
}

// ── Sport picker + root ───────────────────────────────────────────────────────

export default function ScoreboardSection({ orgColor }) {
  const [sport, setSport] = useState(null)

  if (!sport) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        <h2 className="text-xl font-black text-white tracking-wide">Choose Sport</h2>
        <div className="flex gap-6 flex-wrap justify-center">
          {[
            { id:'football',   label:'Football',   emoji:'🏈' },
            { id:'basketball', label:'Basketball', emoji:'🏀' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setSport(s.id)}
              className="flex flex-col items-center gap-4 rounded-2xl transition-all"
              style={{ backgroundColor:'#1a0000', border:'2px solid #2a0000', padding: '2.5rem 3rem', minWidth: 180 }}
            >
              <span style={{ fontSize: 64 }}>{s.emoji}</span>
              <span className="font-black text-white text-lg">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex items-center gap-3 px-4 pt-3 shrink-0">
        <button
          onClick={() => setSport(null)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ border:'1px solid #2a0000', color:'#9a8080' }}
        >
          ← Change
        </button>
        <span className="font-black text-white text-base">
          {sport === 'football' ? '🏈 Football' : '🏀 Basketball'}
        </span>
      </div>
      {sport === 'football'
        ? <FootballScoreboard orgColor={orgColor} />
        : <BasketballScoreboard orgColor={orgColor} />
      }
    </div>
  )
}
