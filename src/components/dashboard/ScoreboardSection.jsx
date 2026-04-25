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
          fontSize: 'clamp(3rem, 10vw, 7rem)',
          color,
          backgroundColor: '#1a0000',
          border:          `2px solid ${color}`,
          fontVariantNumeric: 'tabular-nums',
          width: 'clamp(220px, 30vw, 420px)',
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
        fontSize:           'clamp(3rem, 10vw, 7rem)',
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

      {/* Row 1: Game clock — dominant and centered */}
      <div className="shrink-0 flex flex-col gap-3 rounded-2xl px-6 py-4"
        style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <select
            value={quarter}
            onChange={e => { setQuarter(Number(e.target.value)); setGameSecs(15*60); setGameRun(false) }}
            className="rounded-xl px-4 py-3 text-sm font-bold outline-none"
            style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }}
          >
            {QUARTERS.map((l,i) => <option key={l} value={i}>{l}</option>)}
          </select>

          {/* Clock — tap to edit when paused */}
          <div className="flex flex-col items-center gap-1">
            <GameClock secs={gameSecs} warn={gameSecs <= 60} running={gameRun} onChange={setGameSecs} />
            {!gameRun && (
              <span className="text-xs" style={{ color: '#3a1818' }}>tap clock to set time</span>
            )}
          </div>

          <div className="flex gap-2">
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

        {/* Game clock presets */}
        <div className="flex items-center gap-2 flex-wrap">
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

function BasketballScoreboard({ orgColor }) {
  const [home, setHome] = useState({ name: 'HOME', score: 0, fouls: 0 })
  const [away, setAway] = useState({ name: 'AWAY', score: 0, fouls: 0 })
  const [period, setPeriod]         = useState(0)
  const [periodType, setPeriodType] = useState('quarters')
  const [possession, setPossession] = useState(null)
  const [gameSecs, setGameSecs]     = useState(10 * 60)
  const [gameRun, setGameRun]       = useState(false)
  const [shotSecs, setShotSecs]     = useState(24)
  const [shotRun, setShotRun]       = useState(false)
  const [shotPreset, setShotPreset] = useState(24)

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

  const ScoreButtons = ({ setTeam }) => (
    <div className="flex flex-wrap gap-2 justify-center">
      {[3,2,1].map(p => (
        <button key={p} onClick={() => adj(setTeam, p)}
          className="w-14 h-12 rounded-xl text-sm font-black"
          style={{ backgroundColor:`${orgColor}22`, border:`1px solid ${orgColor}`, color: orgColor }}>
          +{p}
        </button>
      ))}
      <button onClick={() => adj(setTeam, -1)}
        className="w-14 h-12 rounded-xl text-sm font-black"
        style={{ backgroundColor:'#1a0000', border:'1px solid #3a0000', color:'#9a8080' }}>
        -1
      </button>
    </div>
  )

  const FoulCounter = ({ team, setTeam }) => {
    const bonus = team.fouls >= 7
    return (
      <div className="flex items-center gap-3">
        <button onClick={() => setTeam(t => ({ ...t, fouls: Math.max(0, t.fouls-1) }))}
          className="w-9 h-9 rounded-lg text-sm font-bold" style={{ border:'1px solid #2a0000', color:'#9a8080' }}>−</button>
        <div className="text-center w-16">
          <div className="font-black text-lg" style={{ color: bonus ? '#f59e0b' : '#fff', fontVariantNumeric:'tabular-nums' }}>{team.fouls}</div>
          <div className="text-xs font-bold" style={{ color: bonus ? '#f59e0b' : '#4a2020' }}>{bonus ? 'BONUS' : 'FOULS'}</div>
        </div>
        <button onClick={() => setTeam(t => ({ ...t, fouls: t.fouls+1 }))}
          className="w-9 h-9 rounded-lg text-sm font-bold" style={{ border:'1px solid #2a0000', color:'#9a8080' }}>+</button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-3 p-4 overflow-hidden min-h-0">

      {/* Row 1: Game clock */}
      <div className="shrink-0 flex flex-col gap-3 rounded-2xl px-6 py-4"
        style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {['quarters','halves'].map(t => (
              <Btn key={t} orgColor={orgColor} active={periodType===t} sm
                onClick={() => { setPeriodType(t); setPeriod(0); setGameSecs(t==='halves'?20*60:10*60); setGameRun(false) }}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </Btn>
            ))}
            <select
              value={period}
              onChange={e => { setPeriod(Number(e.target.value)); setGameSecs(pDur); setGameRun(false) }}
              className="rounded-xl px-4 py-3 text-sm font-bold outline-none"
              style={{ backgroundColor:'#1a0000', border:'1px solid #2a0000', color:'#fff' }}
            >
              {pLabels.map((l,i) => <option key={l} value={i}>{l}</option>)}
            </select>
          </div>

          <div className="flex flex-col items-center gap-1">
            <GameClock secs={gameSecs} warn={gameSecs <= 60} running={gameRun} onChange={setGameSecs} />
            {!gameRun && (
              <span className="text-xs" style={{ color: '#3a1818' }}>tap clock to set time</span>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setGameRun(r => !r)}
              className="px-8 py-3 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: orgColor }}>
              {gameRun ? '⏸ Pause' : '▶ Start'}
            </button>
            <button onClick={() => { setGameRun(false); setGameSecs(pDur) }}
              className="px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ border:'1px solid #2a0000', color:'#9a8080' }}>
              Reset
            </button>
          </div>
        </div>

        {/* Game clock presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest" style={{ color: '#4a2020' }}>Set Clock</span>
          {[[10,0],[5,0],[2,0],[1,0],[0,30]].map(([m,s]) => (
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
      </div>

      {/* Row 2: Teams */}
      <div className="flex-1 flex gap-3 min-h-0">
        {[['home', home, setHome], ['away', away, setAway]].map(([side, team, setTeam]) => (
          <div key={side} className="flex-1 flex flex-col items-center justify-around gap-3 rounded-2xl p-4"
            style={{ backgroundColor:'#110000', border:'1px solid #2a0000' }}>
            <input
              value={team.name}
              onChange={e => setTeam(t => ({ ...t, name: e.target.value }))}
              className="text-center text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2.5 w-full outline-none"
              style={{ backgroundColor:'transparent', border:'1px solid #2a0000', color:'#9a8080' }}
              maxLength={20}
            />
            <button
              onClick={() => setPossession(p => p === side ? null : side)}
              title="Possession"
              className="w-4 h-4 rounded-full transition-all"
              style={{ backgroundColor: possession === side ? orgColor : '#2a0000' }}
            />
            <div className="font-black text-white select-none"
              style={{ fontSize:'clamp(5rem,16vw,9rem)', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
              {team.score}
            </div>
            <ScoreButtons setTeam={setTeam} />
            <FoulCounter team={team} setTeam={setTeam} />
          </div>
        ))}
      </div>

      {/* Row 3: Shot clock */}
      <div className="shrink-0 flex items-center gap-4 flex-wrap rounded-2xl px-6 py-4"
        style={{ backgroundColor:'#110000', border:'1px solid #2a0000' }}>
        <span className="text-xs uppercase tracking-widest font-bold" style={{ color:'#9a8080' }}>Shot Clock</span>
        <AdjustableClock
          secs={shotSecs}
          warn={shotSecs <= 5}
          onAdjust={d => { setShotRun(false); setShotSecs(s => Math.max(0, Math.min(35, s + d))) }}
        />
        <div className="flex gap-2 ml-auto flex-wrap">
          {[24, 14].map(p => (
            <Btn key={p} onClick={() => resetShot(p)} active={shotPreset===p} orgColor={orgColor} sm>{p}s</Btn>
          ))}
          <Btn onClick={() => resetShot(shotPreset)} sm>Reset</Btn>
          <button
            onClick={() => setShotRun(r => !r)}
            className="px-5 py-3 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: orgColor }}
          >
            {shotRun ? '⏸' : '▶'}
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
