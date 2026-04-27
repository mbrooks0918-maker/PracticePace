import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import AudioSection from '../components/dashboard/AudioSection'
import {
  subscribe as subscribeAudio,
  getSnapshot as getAudioSnapshot,
  togglePlay as audioTogglePlay,
} from '../lib/audioPlayer'

import PracticeSection   from '../components/dashboard/PracticeSection'
import ScriptsSection    from '../components/dashboard/ScriptsSection'
import ScoreboardSection from '../components/dashboard/ScoreboardSection'
import VideoSection      from '../components/dashboard/VideoSection'
import SettingsSection   from '../components/dashboard/SettingsSection'

import {
  getGuestScripts,
  getGuestActiveId,
  setGuestActiveId,
  seedGuestIfEmpty,
} from '../lib/guestStorage'

// ── Icons ─────────────────────────────────────────────────────────────────────
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const Ico = ({ children, size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" {...S}>{children}</svg>

const ClockIcon  = ({ size }) => <Ico size={size}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>
const FileIcon   = ({ size }) => <Ico size={size}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Ico>
const ListIcon   = ({ size }) => <Ico size={size}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></Ico>
const VideoIcon  = ({ size }) => <Ico size={size}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></Ico>
const MusicIcon  = ({ size }) => <Ico size={size}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></Ico>
const GearIcon   = ({ size }) => <Ico size={size}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></Ico>
const LogoutIcon = () => <Ico size={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Ico>

// ── Nav items (settings hidden for guests — handled in render) ─────────────────
const NAV = [
  { id: 'practice',   label: 'Practice',   Icon: ClockIcon },
  { id: 'scripts',    label: 'Scripts',    Icon: FileIcon },
  { id: 'scoreboard', label: 'Scoreboard', Icon: ListIcon },
  { id: 'video',      label: 'Video',      Icon: VideoIcon },
  { id: 'audio',      label: 'Music',      Icon: MusicIcon },
  { id: 'settings',   label: 'Settings',   Icon: GearIcon },
]

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, profile: authProfile, signOut } = useAuth()
  const navigate = useNavigate()

  // Anonymous Supabase users have is_anonymous === true
  const isGuest = user?.is_anonymous === true

  // org_id comes directly from the profile row — no join required
  const contextOrgId = authProfile?.org_id ?? null

  const [section, setSection]           = useState('practice')
  const [org, setOrg]                   = useState(null)
  const [profile, setProfile]           = useState(null)
  const [scripts, setScripts]           = useState([])
  const [activeScript, setActiveScript] = useState(null)
  const [loading, setLoading]           = useState(true)

  // Safety net: if loadAll() never finishes, force-unblock after 3 s
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => {
      console.warn('[Dashboard] Load timeout — forcing loading=false')
      setLoading(false)
    }, 3000)
    return () => clearTimeout(t)
  }, [loading])

  // App resume fix: when iPad returns from background the auth layer can
  // set loading=true while refreshing its token. If the session is still
  // valid, clear our loading flag immediately instead of waiting for a full
  // data reload (which may never complete if the network is briefly flaky).
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      if (!loading) return   // already unblocked — nothing to do
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          console.log('[Dashboard] App resumed with valid session — clearing loading')
          setLoading(false)
        }
      } catch {
        setLoading(false)    // clear anyway; don't leave user stuck
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [loading])

  // ── MP3 mini player state ──────────────────────────────────────────────────
  const [audioSnap, setAudioSnap] = useState(() => getAudioSnapshot())
  useEffect(() => {
    return subscribeAudio((type, payload) => {
      if (type === 'state') setAudioSnap({ ...payload })
    })
  }, [])

  const showMiniPlayer = !!(audioSnap.song && audioSnap.isPlaying)

  const orgColor = org?.primary_color ?? '#cc1111'

  useEffect(() => {
    if (user) loadAll()
  }, [user])

  async function loadAll() {
    // ── Guest path: everything comes from localStorage ──────────────────────
    if (isGuest) {
      try {
        seedGuestIfEmpty()
        const guestScripts = getGuestScripts()
        setScripts(guestScripts)

        const activeId = getGuestActiveId()
        const active   = guestScripts.find(s => s.id === activeId) ?? guestScripts[0] ?? null
        setActiveScript(active)
      } catch (err) {
        console.error('[Dashboard] Guest loadAll error:', err)
      } finally {
        setLoading(false)
      }
      return
    }

    // ── Authenticated path: Supabase ─────────────────────────────────────────
    try {
      // Fetch profile first, then fetch org explicitly by org_id.
      // We do NOT use the nested organizations(*) join because PostgREST can
      // return null for it silently if the FK schema cache hasn't refreshed.
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, org_id, full_name, email, role')
        .eq('id', user.id)
        .maybeSingle()

      setProfile(prof ?? null)

      const resolvedOrgId = prof?.org_id ?? contextOrgId

      // Explicit org fetch — always reliable, never depends on FK join caching
      let orgData = null
      if (resolvedOrgId) {
        const { data: orgFetch } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', resolvedOrgId)
          .maybeSingle()
        orgData = orgFetch ?? null
      }
      setOrg(orgData)

      if (resolvedOrgId) {
        const list = await loadScripts(resolvedOrgId)
        if (list.length === 0) {
          const sample = await seedSampleScript(resolvedOrgId, user.id, orgData?.sport?.toLowerCase())
          if (sample) {
            setScripts([sample])
            setActiveScript(sample)
          }
        }
      }
    } catch (err) {
      console.error('[Dashboard] loadAll error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadScripts(orgId) {
    // ── Guest ──────────────────────────────────────────────────────────────
    if (isGuest) {
      const list = getGuestScripts()
      setScripts(list)
      return list
    }

    // ── Authenticated ──────────────────────────────────────────────────────
    // Prefer the explicit orgId arg, then the one in context, then org state
    const id = orgId ?? contextOrgId ?? org?.id
    if (!id) return []
    const { data } = await supabase
      .from('scripts')
      .select('*')
      .eq('org_id', id)
      .order('created_at', { ascending: false })
    const list = data ?? []
    setScripts(list)
    return list
  }

  async function seedSampleScript(orgId, userId, sport = 'football') {
    const drills = [
      { name: 'Warm Up & Stretch',      duration: 10 * 60 },
      { name: 'Individual / Position',  duration: 20 * 60 },
      { name: 'Group / Unit Period',    duration: 15 * 60 },
      { name: 'Team Period',            duration: 25 * 60 },
      { name: 'Special Teams',          duration: 10 * 60 },
      { name: 'Conditioning',           duration:  8 * 60 },
      { name: 'Cool Down',              duration:  2 * 60 },
    ]
    const { data, error } = await supabase
      .from('scripts')
      .insert({ org_id: orgId, created_by: userId, name: 'Sample Practice — 90 min', sport: sport.toLowerCase(), drills })
      .select()
      .single()
    if (error) return null
    return data
  }

  function handleSetActive(script) {
    setActiveScript(script)
    if (isGuest) setGuestActiveId(script?.id ?? null)
    if (script) setSection('practice')
  }

  function handleOrgUpdate(updated) {
    setOrg(updated)
  }

  // Guest taps Settings tab → redirect to scripts (guests don't have settings)
  function handleNavClick(id) {
    if (isGuest && id === 'settings') return // blocked
    setSection(id)
  }

  // Nav items shown to guests (no Settings)
  const visibleNav = isGuest ? NAV.filter(n => n.id !== 'settings') : NAV

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#080000' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#cc1111', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#080000' }}>

      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 md:px-6 shrink-0 z-10"
        style={{
          height: 56,
          backgroundColor: '#0d0000',
          borderBottom: `2px solid ${orgColor}`,
          boxShadow: `0 2px 24px ${orgColor}44`,
        }}
      >
        <Logo variant="white" height={36} className="shrink-0" />

        <span className="font-bold text-white text-sm md:text-base text-center truncate px-4 max-w-[200px] md:max-w-sm">
          {isGuest ? 'Guest Mode' : (org?.name ?? '')}
        </span>

        <button
          onClick={signOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'rgba(0,0,0,0.22)', color: 'rgba(255,255,255,0.88)' }}
        >
          <LogoutIcon />
          <span className="hidden sm:inline">{isGuest ? 'Exit' : 'Sign out'}</span>
        </button>
      </header>

      {/* ── Guest banner ── */}
      {isGuest && (
        <div
          className="shrink-0 flex items-center justify-center gap-3 px-4 py-2 text-xs font-semibold"
          style={{ backgroundColor: '#1a0d00', borderBottom: '1px solid #3a2000' }}
        >
          <span style={{ color: '#cc8800' }}>👤 Guest mode — data saved on this device only.</span>
          <button
            onClick={() => navigate('/')}
            className="underline font-bold transition-opacity hover:opacity-70"
            style={{ color: '#ffaa00' }}
          >
            Sign up to sync →
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden"
          style={{ paddingBottom: showMiniPlayer ? 120 : 68 }}>

          {section === 'practice' && (
            <PracticeSection
              activeScript={activeScript}
              orgColor={orgColor}
              backgroundUrl={org?.background_url ?? null}
            />
          )}

          {section === 'scripts' && (
            <ScriptsSection
              scripts={scripts}
              activeScript={activeScript}
              onSetActive={handleSetActive}
              orgId={org?.id ?? contextOrgId}
              userId={user?.id}
              orgColor={orgColor}
              isGuest={isGuest}
              orgSport={org?.sport}
              onReload={() => loadScripts(org?.id ?? contextOrgId)}
            />
          )}

          {section === 'scoreboard' && (
            <ScoreboardSection orgColor={orgColor} />
          )}

          {section === 'video' && (
            <VideoSection
              orgId={org?.id ?? contextOrgId}
              orgColor={orgColor}
              isGuest={isGuest}
            />
          )}

          {section === 'audio' && (
            <AudioSection orgColor={orgColor} />
          )}

          {section === 'settings' && !isGuest && (
            <SettingsSection
              org={org}
              profile={profile ?? authProfile}
              orgColor={orgColor}
              onOrgUpdate={handleOrgUpdate}
            />
          )}

        </main>
      </div>

      {/* ── MP3 mini player (shown on all tabs when a song is playing) ── */}
      {showMiniPlayer && (() => {
        const { song, isPlaying } = audioSnap
        return (
          <div
            className="fixed left-0 right-0 flex items-center gap-3 px-4"
            style={{
              bottom: 68, height: 52, zIndex: 19,
              backgroundColor: '#0d0800',
              borderTop: `1px solid ${orgColor}33`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: `${orgColor}22` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={orgColor} strokeWidth="2" strokeLinecap="round">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">{song?.name ?? ''}</p>
              <p className="text-xs leading-tight" style={{ color: '#9a8080' }}>Now Playing</p>
            </div>
            <button
              onClick={() => audioTogglePlay().catch(() => {})}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
              style={{ backgroundColor: orgColor, boxShadow: `0 0 12px ${orgColor}66` }}
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 2 }}>
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>
          </div>
        )
      })()}

      {/* ── Tab bar ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex z-20"
        style={{ height: 68, backgroundColor: '#0d0000', borderTop: `1px solid ${orgColor}44` }}
      >
        {visibleNav.map(({ id, label, Icon }) => {
          const active = section === id
          return (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 font-semibold transition-colors"
              style={{ color: active ? orgColor : '#7a6060', fontSize: 13 }}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
