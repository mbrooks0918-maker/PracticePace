import { useState, useEffect, useRef } from 'react'

function pad(n) { return String(n).padStart(2, '0') }
function fmtClock(s) { return `${pad(Math.floor(Math.abs(s) / 60))}:${pad(Math.abs(s) % 60)}` }

function useClock(running) {
  const [secs, setSecs]   = useState(0)
  const runRef            = useRef(false)
  useEffect(() => { runRef.current = running }, [running])
  return [secs, setSecs]
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ClockDisplay({ secs, color = '#fff' }) {
  return (
    <span
      className="font-mono font-bold"
      style={{ fontSize: 'clamp(2.5rem, 10vw, 4rem)', color, fontVariantNumeric: 'tabular-nums' }}
    >
      {fmtClock(secs)}
    </span>
  )
}

function SmallClock({ secs, warn = false }) {
  return (
    <span
      className="font-mono font-bold"
      style={{ fontSize: '2rem', fontVariantNumeric: 'tabular-nums', color: warn ? '#ef4444' : '#fff' }}
    >
      {pad(secs)}
    </span>
  )
}

function ScorePanel({ team, onScore, onNameChange, orgColor, side, extra }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-3 p-4">
      <input
        value={team.name}
        onChange={e => onNameChange(e.target.value)}
        className="text-center text-xs font-bold uppercase tracking-widest rounded-lg px-2 py-1.5 w-full outline-none"
        style={{ backgroundColor: 'transparent', border: '1px solid #2a0000', color: '#9a8080' }}
        maxLength={20}
      />
      <div
        className="font-bold text-white select-none"
        style={{ fontSize: 'clamp(3rem, 12vw, 5.5rem)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
      >
        {team.score}
      </div>
      <div className="flex flex-wrap gap-1 justify-center">
        {extra}
      </div>
      <div className="flex flex-wrap gap-1 justify-center">
        {onScore.map(([pts, label]) => (
          <button
            key={pts}
            onClick={() => {}}
            className="hidden"
          />
        ))}
      </div>
    </div>
  )
}

function Card({ children }) {
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
      {children}
    </div>
  )
}

function Btn({ onClick, children, active, orgColor, small }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg font-bold transition-all ${small ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-xs'}`}
      style={{
        backgroundColor: active ? orgColor : '#1a0000',
        border: `1px solid ${active ? orgColor : '#2a0000'}`,
        color: active ? '#fff' : '#9a8080',
      }}
    >
      {children}
    </button>
  )
}

function PlusMinusRow({ label, value, onChange, min = 0, max = 999 }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-widest w-20 text-right" style={{ color: '#4a2020' }}>{label}</span>
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded text-xs font-bold" style={{ border: '1px solid #2a0000', color: '#9a8080' }}>−</button>
      <span className="text-white font-bold text-sm w-8 text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded text-xs font-bold" style={{ border: '1px solid #2a0000', color: '#9a8080' }}>+</button>
    </div>
  )
}

// ── Football ──────────────────────────────────────────────────────────────────

const QUARTERS  = ['Q1','Q2','Q3','Q4','OT']
const DOWNS     = ['1st','2nd','3rd','4th']

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

  // Game clock
  useEffect(() => {
    if (!gameRun) return
    const id = setInterval(() => setGameSecs(s => { if (s <= 0) { setGameRun(false); return 0 } return s - 1 }), 1000)
    return () => clearInterval(id)
  }, [gameRun])

  // Play clock
  useEffect(() => {
    if (!playRun) return
    const id = setInterval(() => setPlaySecs(s => { if (s <= 0) { setPlayRun(false); return 0 } return s - 1 }), 1000)
    return () => clearInterval(id)
  }, [playRun])

  function resetPlay(preset = playPreset) {
    setPlayRun(false); setPlaySecs(preset); setPlayPreset(preset)
  }

  function score(team, setTeam, pts) {
    setTeam(t => ({ ...t, score: Math.max(0, t.score + pts) }))
  }

  const ScoreButtons = ({ team, setTeam }) => (
    <div className="flex flex-wrap gap-1 justify-center">
      {[7, 6, 3, 2, 1].map(p => (
        <button key={p} onClick={() => score(team, setTeam, p)}
          className="px-2 py-1 rounded text-xs font-bold"
          style={{ backgroundColor: `${orgColor}22`, border: `1px solid ${orgColor}`, color: orgColor }}>
          +{p}
        </button>
      ))}
      <button onClick={() => score(team, setTeam, -1)}
        className="px-2 py-1 rounded text-xs font-bold"
        style={{ backgroundColor: '#1a0000', border: '1px solid #3a0000', color: '#9a8080' }}>
        -1
      </button>
    </div>
  )

  const TimeoutDots = ({ team, setTeam }) => (
    <div className="flex items-center gap-1.5">
      <span className="text-xs uppercase tracking-widest mr-1" style={{ color: '#4a2020' }}>TO</span>
      {[0,1,2].map(i => (
        <button
          key={i}
          onClick={() => setTeam(t => ({ ...t, timeouts: i < t.timeouts ? Math.max(0, t.timeouts - 1) : Math.min(3, t.timeouts + 1) }))}
          className="w-4 h-4 rounded-full transition-all"
          style={{ backgroundColor: i < team.timeouts ? orgColor : '#2a0000' }}
        />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-3 p-4 max-w-2xl mx-auto w-full">
      {/* Game clock */}
      <Card>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            <ClockDisplay secs={gameSecs} />
            <select value={quarter}
              onChange={e => { setQuarter(Number(e.target.value)); setGameSecs(15*60); setGameRun(false) }}
              className="rounded-lg px-3 py-2 text-sm font-bold outline-none"
              style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }}>
              {QUARTERS.map((l,i) => <option key={l} value={i}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setGameRun(r => !r)} className="px-6 py-2 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: orgColor }}>
              {gameRun ? '⏸ Pause' : '▶ Start'}
            </button>
            <button onClick={() => { setGameRun(false); setGameSecs(15*60) }}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ border: '1px solid #2a0000', color: '#9a8080' }}>Reset</button>
          </div>
        </div>
      </Card>

      {/* Teams */}
      <div className="flex rounded-2xl overflow-hidden" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
        <div className="flex-1 flex flex-col items-center gap-3 p-4">
          <input value={home.name} onChange={e => setHome(h => ({ ...h, name: e.target.value }))}
            className="text-center text-xs font-bold uppercase tracking-widest rounded-lg px-2 py-1.5 w-full outline-none"
            style={{ backgroundColor: 'transparent', border: '1px solid #2a0000', color: '#9a8080' }} maxLength={20} />
          <div className="font-bold text-white" style={{ fontSize: 'clamp(3rem,12vw,5rem)', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{home.score}</div>
          <ScoreButtons team={home} setTeam={setHome} />
          <TimeoutDots team={home} setTeam={setHome} />
        </div>
        <div className="w-px" style={{ backgroundColor: '#2a0000' }} />
        <div className="flex-1 flex flex-col items-center gap-3 p-4">
          <input value={away.name} onChange={e => setAway(a => ({ ...a, name: e.target.value }))}
            className="text-center text-xs font-bold uppercase tracking-widest rounded-lg px-2 py-1.5 w-full outline-none"
            style={{ backgroundColor: 'transparent', border: '1px solid #2a0000', color: '#9a8080' }} maxLength={20} />
          <div className="font-bold text-white" style={{ fontSize: 'clamp(3rem,12vw,5rem)', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{away.score}</div>
          <ScoreButtons team={away} setTeam={setAway} />
          <TimeoutDots team={away} setTeam={setAway} />
        </div>
      </div>

      {/* Situation */}
      <Card>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#4a2020' }}>Down</span>
            {DOWNS.map((d,i) => (
              <button key={d} onClick={() => setDown(i)}
                className="w-10 h-8 rounded-lg text-xs font-bold transition-all"
                style={{ backgroundColor: down===i ? orgColor : '#1a0000', border:`1px solid ${down===i ? orgColor : '#2a0000'}`, color: down===i ? '#fff' : '#9a8080' }}>
                {d}
              </button>
            ))}
          </div>
          <PlusMinusRow label="& (yds)" value={distance} onChange={setDistance} min={1} max={99} />
          <PlusMinusRow label="Ball on" value={ballOn} onChange={setBallOn} min={1} max={99} />
        </div>
      </Card>

      {/* Play clock */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#4a2020' }}>Play Clock</span>
            <SmallClock secs={playSecs} warn={playSecs <= 5} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[40, 25].map(p => (
              <Btn key={p} onClick={() => resetPlay(p)} active={playPreset === p} orgColor={orgColor} small>{p}s</Btn>
            ))}
            <button onClick={() => resetPlay(playPreset)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ border: '1px solid #2a0000', color: '#9a8080' }}>Reset</button>
            <button onClick={() => setPlayRun(r => !r)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: orgColor }}>
              {playRun ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      </Card>
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

  const pLabels  = periodType === 'halves' ? PERIODS_H : PERIODS_Q
  const pDur     = periodType === 'halves' ? 20 * 60 : 10 * 60

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

  function resetShot(preset = shotPreset) {
    setShotRun(false); setShotSecs(preset); setShotPreset(preset)
  }

  function adjustScore(team, setTeam, pts) {
    setTeam(t => ({ ...t, score: Math.max(0, t.score + pts) }))
  }

  const ScoreButtons = ({ team, setTeam }) => (
    <div className="flex flex-wrap gap-1 justify-center">
      {[3,2,1].map(p => (
        <button key={p} onClick={() => adjustScore(team, setTeam, p)}
          className="px-2 py-1 rounded text-xs font-bold"
          style={{ backgroundColor: `${orgColor}22`, border:`1px solid ${orgColor}`, color: orgColor }}>+{p}</button>
      ))}
      <button onClick={() => adjustScore(team, setTeam, -1)}
        className="px-2 py-1 rounded text-xs font-bold"
        style={{ backgroundColor:'#1a0000', border:'1px solid #3a0000', color:'#9a8080' }}>-1</button>
    </div>
  )

  const FoulCounter = ({ team, setTeam }) => {
    const bonus = team.fouls >= 7
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setTeam(t => ({ ...t, fouls: Math.max(0, t.fouls-1) }))}
          className="w-7 h-7 rounded text-xs font-bold" style={{ border:'1px solid #2a0000', color:'#9a8080' }}>−</button>
        <div className="text-center w-12">
          <div className="font-bold text-sm" style={{ color: bonus ? '#f59e0b' : '#fff', fontVariantNumeric:'tabular-nums' }}>{team.fouls}</div>
          <div className="text-xs" style={{ color: bonus ? '#f59e0b' : '#4a2020' }}>{bonus ? 'BONUS' : 'FOULS'}</div>
        </div>
        <button onClick={() => setTeam(t => ({ ...t, fouls: t.fouls+1 }))}
          className="w-7 h-7 rounded text-xs font-bold" style={{ border:'1px solid #2a0000', color:'#9a8080' }}>+</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 max-w-2xl mx-auto w-full">
      {/* Period type */}
      <div className="flex gap-2 justify-center">
        {['quarters','halves'].map(t => (
          <Btn key={t} orgColor={orgColor} active={periodType===t}
            onClick={() => { setPeriodType(t); setPeriod(0); setGameSecs(t==='halves'?20*60:10*60); setGameRun(false) }}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </Btn>
        ))}
      </div>

      {/* Game clock */}
      <Card>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            <ClockDisplay secs={gameSecs} />
            <select value={period}
              onChange={e => { setPeriod(Number(e.target.value)); setGameSecs(pDur); setGameRun(false) }}
              className="rounded-lg px-3 py-2 text-sm font-bold outline-none"
              style={{ backgroundColor:'#1a0000', border:'1px solid #2a0000', color:'#fff' }}>
              {pLabels.map((l,i) => <option key={l} value={i}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setGameRun(r => !r)} className="px-6 py-2 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: orgColor }}>
              {gameRun ? '⏸ Pause' : '▶ Start'}
            </button>
            <button onClick={() => { setGameRun(false); setGameSecs(pDur) }}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ border:'1px solid #2a0000', color:'#9a8080' }}>Reset</button>
          </div>
        </div>
      </Card>

      {/* Teams */}
      <div className="flex rounded-2xl overflow-hidden" style={{ backgroundColor:'#110000', border:'1px solid #2a0000' }}>
        {[['home', home, setHome], ['away', away, setAway]].map(([side, team, setTeam], idx) => (
          <div key={side} className="flex-1 flex flex-col items-center gap-3 p-4" style={idx===0 ? { borderRight:'1px solid #2a0000' } : {}}>
            <input value={team.name} onChange={e => setTeam(t => ({ ...t, name: e.target.value }))}
              className="text-center text-xs font-bold uppercase tracking-widest rounded-lg px-2 py-1.5 w-full outline-none"
              style={{ backgroundColor:'transparent', border:'1px solid #2a0000', color:'#9a8080' }} maxLength={20} />
            {/* Possession indicator */}
            <button
              onClick={() => setPossession(p => p === side ? null : side)}
              title="Possession"
              className="w-3 h-3 rounded-full transition-all"
              style={{ backgroundColor: possession === side ? orgColor : '#2a0000' }}
            />
            <div className="font-bold text-white" style={{ fontSize:'clamp(3rem,12vw,5rem)', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
              {team.score}
            </div>
            <ScoreButtons team={team} setTeam={setTeam} />
            <FoulCounter team={team} setTeam={setTeam} />
          </div>
        ))}
      </div>

      {/* Shot clock */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest" style={{ color:'#4a2020' }}>Shot Clock</span>
            <SmallClock secs={shotSecs} warn={shotSecs <= 5} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[24, 14].map(p => (
              <Btn key={p} onClick={() => resetShot(p)} active={shotPreset===p} orgColor={orgColor} small>{p}s</Btn>
            ))}
            <button onClick={() => resetShot(shotPreset)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ border:'1px solid #2a0000', color:'#9a8080' }}>Reset</button>
            <button onClick={() => setShotRun(r => !r)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: orgColor }}>
              {shotRun ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Sport Selector + Main ─────────────────────────────────────────────────────

export default function ScoreboardSection({ orgColor }) {
  const [sport, setSport] = useState(null)

  if (!sport) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <h2 className="text-lg font-bold text-white">Choose sport</h2>
        <div className="flex gap-4 flex-wrap justify-center">
          {[{ id:'football', label:'Football', emoji:'🏈' }, { id:'basketball', label:'Basketball', emoji:'🏀' }].map(s => (
            <button key={s.id} onClick={() => setSport(s.id)}
              className="flex flex-col items-center gap-3 p-8 rounded-2xl transition-all hover:border-opacity-60"
              style={{ backgroundColor:'#1a0000', border:'2px solid #2a0000', minWidth:160 }}>
              <span style={{ fontSize:52 }}>{s.emoji}</span>
              <span className="font-bold text-white">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 max-w-2xl mx-auto w-full">
        <button onClick={() => setSport(null)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ border:'1px solid #2a0000', color:'#9a8080' }}>← Change</button>
        <span className="font-bold text-white">{sport==='football' ? '🏈 Football' : '🏀 Basketball'}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sport === 'football'
          ? <FootballScoreboard orgColor={orgColor} />
          : <BasketballScoreboard orgColor={orgColor} />
        }
      </div>
    </div>
  )
}
