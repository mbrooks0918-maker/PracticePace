import { useState, useRef } from 'react'
import {
  playAirHorn, playWhistle, playStadiumCrowd,
  playPeriodEnd, playDrumline, playCrowdClap,
  getAutoSounds, setAutoSound, resumeCtx,
} from '../../lib/sounds'

// ── Sound definitions (no emoji — clean text labels with SVG icons) ────────────
const SOUNDS = [
  {
    key: 'airhorn',
    label: 'Air Horn',
    fn: playAirHorn,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>
    ),
  },
  {
    key: 'whistle',
    label: 'Whistle',
    fn: playWhistle,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="14" r="5"/>
        <path d="M21 3 9.5 10"/>
        <path d="M15 9.5 21 3"/>
      </svg>
    ),
  },
  {
    key: 'crowd',
    label: 'Crowd Roar',
    fn: playStadiumCrowd,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'periodend',
    label: 'Buzzer',
    fn: playPeriodEnd,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    key: 'drumline',
    label: 'Drumline',
    fn: playDrumline,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 5v14a9 3 0 0 1-18 0V5"/>
        <path d="M3 12a9 3 0 0 0 18 0"/>
      </svg>
    ),
  },
  {
    key: 'crowdclap',
    label: 'Crowd Clap',
    fn: playCrowdClap,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2v7.5"/>
        <path d="M9.5 4.5v5"/>
        <path d="M4.5 7v5"/>
        <path d="M4.5 12c0 5.25 4.25 9.5 9.5 9.5s9.5-4.25 9.5-9.5"/>
        <path d="M19.5 7v5"/>
      </svg>
    ),
  },
]

const AUTO_TOGGLES = [
  { key: 'hornOnEnd',      label: 'Air horn when period ends',  default: true },
  { key: 'whistleAt60',    label: 'Whistle at 1:00 remaining',  default: true },
  { key: 'alertOnOverrun', label: 'Alert when overrun starts',  default: false },
]

function Toggle({ label, value, onChange, orgColor }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all"
      style={{
        backgroundColor: value ? `${orgColor}18` : '#1a0000',
        border:          `1px solid ${value ? orgColor + '66' : '#2a0000'}`,
      }}
    >
      <span
        className="w-10 h-6 rounded-full relative flex-shrink-0 transition-colors"
        style={{ backgroundColor: value ? orgColor : '#2a0000' }}
      >
        <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow"
          style={{ left: value ? '22px' : '2px' }}
        />
      </span>
      <span className="text-sm font-semibold" style={{ color: value ? '#fff' : '#9a8080' }}>
        {label}
      </span>
    </button>
  )
}

export default function AudioSection({ orgColor }) {
  const [autoSounds, setAutoSoundsState] = useState(() => {
    const saved = getAutoSounds()
    const defaults = {}
    AUTO_TOGGLES.forEach(t => { defaults[t.key] = saved[t.key] ?? t.default })
    return defaults
  })
  const [playing, setPlaying]             = useState(null)
  const [unlocked, setUnlocked]           = useState(false)
  const [customSounds, setCustomSounds]   = useState([])
  const [playingCustom, setPlayingCustom] = useState(null)
  const customInputRef = useRef(null)
  const audioRefs = useRef({})

  async function unlock() {
    await resumeCtx()
    setUnlocked(true)
  }

  async function handlePlay(sound) {
    if (!unlocked) await unlock()
    setPlaying(sound.key)
    try { await sound.fn() } catch (e) { /* ignore */ }
    setTimeout(() => setPlaying(p => p === sound.key ? null : p), 2500)
  }

  function handleToggle(key, value) {
    setAutoSoundsState(s => ({ ...s, [key]: value }))
    setAutoSound(key, value)
  }

  function handleCustomUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) { alert('Please select an audio file (MP3, WAV, etc.)'); return }
    const url   = URL.createObjectURL(file)
    const label = file.name.replace(/\.[^.]+$/, '')
    const key   = `custom_${Date.now()}`
    setCustomSounds(s => [...s, { key, label, url }])
    if (customInputRef.current) customInputRef.current.value = ''
  }

  function playCustom(sound) {
    // Stop any currently playing custom sound
    const prev = audioRefs.current[playingCustom]
    if (prev) { prev.pause(); prev.currentTime = 0 }

    if (playingCustom === sound.key) { setPlayingCustom(null); return }

    const audio = new Audio(sound.url)
    audio.volume = 1.0
    audioRefs.current[sound.key] = audio
    audio.play().catch(() => {})
    setPlayingCustom(sound.key)
    audio.onended = () => setPlayingCustom(p => p === sound.key ? null : p)
  }

  function removeCustom(key) {
    setCustomSounds(s => s.filter(c => c.key !== key))
    if (playingCustom === key) {
      const audio = audioRefs.current[key]
      if (audio) { audio.pause(); audio.currentTime = 0 }
      setPlayingCustom(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* LEFT — Sound Effects */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-black text-white text-lg">Sound Effects</h2>
            <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
              Tap any sound to preview. Use your device volume for loudness control.
            </p>
          </div>

          {!unlocked && (
            <button
              onClick={unlock}
              className="py-3 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: orgColor }}
            >
              Tap here to enable audio
            </button>
          )}

          {/* Built-in sounds — 2 column grid, text labels only */}
          <div className="grid grid-cols-2 gap-3">
            {SOUNDS.map(sound => {
              const isPlaying = playing === sound.key
              return (
                <button
                  key={sound.key}
                  onClick={() => handlePlay(sound)}
                  className="flex flex-col items-center gap-2 rounded-2xl py-5 px-3 transition-all active:scale-95"
                  style={{
                    backgroundColor: isPlaying ? `${orgColor}28` : '#1a0000',
                    border:          `2px solid ${isPlaying ? orgColor : '#2a0000'}`,
                    boxShadow:       isPlaying ? `0 0 20px ${orgColor}44` : 'none',
                    color:           isPlaying ? orgColor : '#9a8080',
                  }}
                >
                  {sound.icon}
                  <span className="text-xs font-bold text-center leading-tight">
                    {sound.label}
                  </span>
                  {isPlaying && (
                    <span className="text-xs animate-pulse font-semibold">▶ playing</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Custom sounds */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Custom Sounds</h3>
                <p className="text-xs mt-0.5" style={{ color: '#9a8080' }}>Upload your own MP3 or audio file</p>
              </div>
              <label
                htmlFor="custom-audio-upload"
                className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all"
                style={{ backgroundColor: `${orgColor}22`, border: `1px solid ${orgColor}`, color: orgColor }}
              >
                + Upload
              </label>
              <input
                ref={customInputRef}
                id="custom-audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleCustomUpload}
                className="hidden"
              />
            </div>

            {customSounds.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: '#4a2020' }}>
                No custom sounds yet — upload an MP3 to add your own.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {customSounds.map(cs => {
                  const isActive = playingCustom === cs.key
                  return (
                    <div
                      key={cs.key}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{
                        backgroundColor: isActive ? `${orgColor}18` : '#1a0000',
                        border:          `1px solid ${isActive ? orgColor + '66' : '#2a0000'}`,
                      }}
                    >
                      <button
                        onClick={() => playCustom(cs)}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                        style={{ backgroundColor: isActive ? orgColor : '#2a0000', color: '#fff' }}
                      >
                        {isActive ? '⏹' : '▶'}
                      </button>
                      <span className="flex-1 text-sm font-semibold truncate" style={{ color: isActive ? '#fff' : '#9a8080' }}>
                        {cs.label}
                      </span>
                      <button
                        onClick={() => removeCustom(cs.key)}
                        className="text-xs px-2 py-1 rounded"
                        style={{ color: '#6a3030' }}
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Auto-Sounds + Music */}
        <div className="flex flex-col gap-6">

          {/* Auto-sounds */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <div>
              <h3 className="font-bold text-white text-base">Auto Sounds</h3>
              <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
                Sounds that fire automatically during practice. Settings save to this device.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {AUTO_TOGGLES.map(t => (
                <Toggle
                  key={t.key}
                  label={t.label}
                  value={autoSounds[t.key] ?? t.default}
                  onChange={v => handleToggle(t.key, v)}
                  orgColor={orgColor}
                />
              ))}
            </div>
          </div>

          {/* Music — polished section */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-white text-base">Music</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#9a8080' }}>
                  Connect your playlist to play music during practice periods. Control playback without leaving the app.
                </p>
              </div>
              <span
                className="shrink-0 text-xs font-black px-2.5 py-1 rounded-full"
                style={{ backgroundColor: '#1a0000', border: '1px solid #3a2000', color: '#cc8800' }}
              >
                Coming Soon
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { name: 'Spotify',     color: '#1db954', logo: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#1db954">
                    <circle cx="12" cy="12" r="12"/>
                    <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15C9.65 6.8 15.6 7 19.35 9.2c.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25m-.1 2.8c-.25.4-.75.5-1.15.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.4.25.5.75.3 1m-1.3 2.8c-.2.35-.65.45-1 .25-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.4.65.4 1" fill="white"/>
                  </svg>
                )},
                { name: 'Apple Music', color: '#fc3c44', logo: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="#fc3c44"/>
                    <path d="M17 8.5v5.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h4l4-2v2.5z" fill="white" opacity=".9"/>
                    <circle cx="10" cy="14" r="1.5" fill="white"/>
                    <circle cx="15" cy="12.5" r="1.5" fill="white"/>
                  </svg>
                )},
              ].map(svc => (
                <button
                  key={svc.name}
                  disabled
                  className="flex items-center gap-4 px-5 py-4 rounded-xl transition-all"
                  style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', opacity: 0.55, cursor: 'not-allowed' }}
                >
                  {svc.logo}
                  <div className="text-left flex-1">
                    <p className="text-sm font-bold text-white">{svc.name}</p>
                    <p className="text-xs" style={{ color: '#9a8080' }}>Connect your account</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: '#2a1800', color: '#cc8800', border: '1px solid #3a2000' }}>
                    Soon
                  </span>
                </button>
              ))}
            </div>

            <p className="text-xs px-1" style={{ color: '#4a2020' }}>
              Full streaming integration arrives in v2.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
