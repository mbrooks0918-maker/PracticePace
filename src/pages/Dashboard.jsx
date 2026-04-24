import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

import PracticeSection   from '../components/dashboard/PracticeSection'
import ScriptsSection    from '../components/dashboard/ScriptsSection'
import ScoreboardSection from '../components/dashboard/ScoreboardSection'
import VideoSection      from '../components/dashboard/VideoSection'
import SettingsSection   from '../components/dashboard/SettingsSection'

// ── Icons ─────────────────────────────────────────────────────────────────────
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const Ico = ({ children, size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" {...S}>{children}</svg>

const ClockIcon  = () => <Ico><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>
const FileIcon   = () => <Ico><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Ico>
const ListIcon   = () => <Ico><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></Ico>
const VideoIcon  = () => <Ico><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></Ico>
const GearIcon   = () => <Ico><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></Ico>
const LogoutIcon = () => <Ico size={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Ico>

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'practice',   label: 'Practice',   Icon: ClockIcon },
  { id: 'scripts',    label: 'Scripts',    Icon: FileIcon },
  { id: 'scoreboard', label: 'Scoreboard', Icon: ListIcon },
  { id: 'video',      label: 'Video',      Icon: VideoIcon },
  { id: 'settings',   label: 'Settings',   Icon: GearIcon },
]

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [section, setSection]           = useState('practice')
  const [org, setOrg]                   = useState(null)
  const [profile, setProfile]           = useState(null)
  const [scripts, setScripts]           = useState([])
  const [activeScript, setActiveScript] = useState(null)
  const [loading, setLoading]           = useState(true)

  const orgColor = org?.primary_color ?? '#cc1111'

  useEffect(() => {
    if (user) loadAll()
  }, [user])

  async function loadAll() {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, org_id, full_name, email, role, organizations(*)')
      .eq('id', user.id)
      .single()

    setProfile(prof ?? null)
    const orgData = prof?.organizations ?? null
    setOrg(orgData)

    if (prof?.org_id) {
      const list = await loadScripts(prof.org_id)

      // First-time login: seed a sample script and set it active
      if (list.length === 0) {
        const sample = await seedSampleScript(prof.org_id, prof.id, orgData?.sport)
        if (sample) {
          setScripts([sample])
          setActiveScript(sample)
        }
      }
    }

    setLoading(false)
  }

  async function loadScripts(orgId) {
    const id = orgId ?? org?.id
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

  async function seedSampleScript(orgId, userId, sport = 'Football') {
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
      .insert({ org_id: orgId, created_by: userId, name: 'Sample Practice — 90 min', sport, drills })
      .select()
      .single()
    if (error) return null
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  function handleSetActive(script) {
    setActiveScript(script)
    if (script) setSection('practice')
  }

  function handleOrgUpdate(updated) {
    setOrg(updated)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#080000' }}>
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#cc1111', borderTopColor: 'transparent' }}
        />
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
          backgroundColor: orgColor,
          boxShadow: `0 2px 24px ${orgColor}66`,
        }}
      >
        <Logo variant="white" height={36} className="shrink-0" />

        <span className="font-bold text-white text-sm md:text-base text-center truncate px-4 max-w-[200px] md:max-w-sm">
          {org?.name ?? ''}
        </span>

        <button
          onClick={signOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'rgba(0,0,0,0.22)', color: 'rgba(255,255,255,0.88)' }}
        >
          <LogoutIcon />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — md+ */}
        <aside
          className="hidden md:flex flex-col py-3 gap-0.5 shrink-0"
          style={{ width: 200, backgroundColor: '#110000', borderRight: '1px solid #1e0000' }}
        >
          {NAV.map(({ id, label, Icon }) => {
            const active = section === id
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                className="flex items-center gap-3 mx-2 px-3 py-3 rounded-lg text-sm font-medium text-left transition-all"
                style={{
                  backgroundColor: active ? `${orgColor}1a` : 'transparent',
                  color:           active ? orgColor : '#7a6060',
                  borderLeft:      active ? `3px solid ${orgColor}` : '3px solid transparent',
                }}
              >
                <Icon />
                {label}
              </button>
            )
          })}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">

          {section === 'practice' && (
            <PracticeSection
              activeScript={activeScript}
              orgColor={orgColor}
            />
          )}

          {section === 'scripts' && (
            <ScriptsSection
              scripts={scripts}
              activeScript={activeScript}
              onSetActive={handleSetActive}
              orgId={org?.id}
              userId={user?.id}
              orgColor={orgColor}
              onReload={() => loadScripts(org?.id)}
            />
          )}

          {section === 'scoreboard' && (
            <ScoreboardSection orgColor={orgColor} />
          )}

          {section === 'video' && (
            <VideoSection
              orgId={org?.id}
              orgColor={orgColor}
            />
          )}

          {section === 'settings' && (
            <SettingsSection
              org={org}
              profile={profile}
              orgColor={orgColor}
              onOrgUpdate={handleOrgUpdate}
            />
          )}

        </main>
      </div>

      {/* ── Bottom tab bar — mobile ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex z-20"
        style={{ height: 60, backgroundColor: '#110000', borderTop: '1px solid #1e0000' }}
      >
        {NAV.map(({ id, label, Icon }) => {
          const active = section === id
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors"
              style={{ color: active ? orgColor : '#7a6060' }}
            >
              <Icon />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
