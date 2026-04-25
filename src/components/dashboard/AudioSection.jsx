import { useState, useEffect } from 'react'
import {
  playAirHorn, playWhistle, playStadiumCrowd,
  playPeriodEnd, playDrumline, playCrowdClap,
  getAutoSounds, setAutoSound, resumeCtx,
} from '../../lib/sounds'

const SOUNDS = [
  { key: 'airhorn',      label: 'Air Horn',       emoji: '📣', fn: playAirHorn },
  { key: 'whistle',      label: 'Whistle',         emoji: '🎵', fn: playWhistle },
  { key: 'crowd',        label: 'Stadium Crowd',   emoji: '🏟️', fn: playStadiumCrowd },
  { key: 'periodend',    label: 'Period End',      emoji: '⏰', fn: playPeriodEnd },
  { key: 'drumline',     label: 'Drumline',        emoji: '🥁', fn: playDrumline },
  { key: 'crowdclap',   label: 'Crowd Clap',      emoji: '👏', fn: playCrowdClap },
]

const AUTO_TOGGLES = [
  { key: 'hornOnEnd',       label: 'Air horn when period ends',     default: true },
  { key: 'whistleAt60',     label: 'Whistle at 1:00 remaining',     default: true },
  { key: 'alertOnOverrun',  label: 'Alert when overrun',            default: false },
]

function Toggle({ label, value, onChange, orgColor }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all"
      style={{
        backgroundColor: value ? `${orgColor}18` : '#1a0000',
        border: `1px solid ${value ? orgColor + '66' : '#2a0000'}`,
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
  const [playing, setPlaying] = useState(null)
  const [unlocked, setUnlocked] = useState(false)

  async function unlock() {
    await resumeCtx()
    setUnlocked(true)
  }

  async function handlePlay(sound) {
    if (!unlocked) await unlock()
    setPlaying(sound.key)
    try { await sound.fn() } catch (e) { /* ignore */ }
    setTimeout(() => setPlaying(p => p === sound.key ? null : p), 2200)
  }

  function handleToggle(key, value) {
    setAutoSoundsState(s => ({ ...s, [key]: value }))
    setAutoSound(key, value)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* LEFT — Sound Effects */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-black text-white text-lg">Sound Effects</h2>
            <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
              Tap any sound to preview it. Sounds play at full volume — use your device volume control.
            </p>
          </div>

          {/* Unlock banner if needed */}
          {!unlocked && (
            <button
              onClick={unlock}
              className="py-3 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: orgColor }}>
              👆 Tap here to enable audio
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            {SOUNDS.map(sound => {
              const isPlaying = playing === sound.key
              return (
                <button
                  key={sound.key}
                  onClick={() => handlePlay(sound)}
                  className="flex flex-col items-center gap-3 rounded-2xl py-6 px-4 transition-all active:scale-95"
                  style={{
                    backgroundColor: isPlaying ? `${orgColor}28` : '#1a0000',
                    border: `2px solid ${isPlaying ? orgColor : '#2a0000'}`,
                    boxShadow: isPlaying ? `0 0 24px ${orgColor}44` : 'none',
                  }}
                >
                  <span style={{ fontSize: 40 }}>{sound.emoji}</span>
                  <span
                    className="text-xs font-bold text-center leading-tight"
                    style={{ color: isPlaying ? orgColor : '#9a8080' }}
                  >
                    {sound.label}
                  </span>
                  {isPlaying && (
                    <span className="text-xs animate-pulse" style={{ color: orgColor }}>▶ playing</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* RIGHT — Auto-Sounds + Music */}
        <div className="flex flex-col gap-6">

          {/* Auto-sounds */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <div>
              <h3 className="font-bold text-white text-base">Auto Sounds</h3>
              <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
                Sounds that fire automatically during practice.
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
            <p className="text-xs" style={{ color: '#4a2020' }}>
              Settings are saved to this device automatically.
            </p>
          </div>

          {/* Music placeholder */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <div>
              <h3 className="font-bold text-white text-base">Music</h3>
              <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
                Connect your music service to control playback during practice.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { name: 'Spotify',     emoji: '🎵', color: '#1db954' },
                { name: 'Apple Music', emoji: '🎶', color: '#fc3c44' },
              ].map(svc => (
                <button
                  key={svc.name}
                  disabled
                  className="flex items-center gap-3 px-4 py-3 rounded-xl opacity-40"
                  style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000' }}
                >
                  <span style={{ fontSize: 22 }}>{svc.emoji}</span>
                  <span className="text-sm font-semibold text-white">{svc.name}</span>
                  <span className="ml-auto text-xs" style={{ color: '#4a2020' }}>Coming soon</span>
                </button>
              ))}
            </div>
            <p className="text-xs px-1" style={{ color: '#4a2020' }}>
              Full music integration coming in v2.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
