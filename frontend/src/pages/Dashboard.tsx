import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearToken, getStoredUser, AccessRequestItem } from '../lib/api'

interface Stats { total: number; today: number; week: number; month: number; avg_per_day: number }
interface ActionItem { name: string; count: number; pct: number }
interface LogItem { action: string; provider: string; model_used: string; domain: string; original_char_count: number; enhanced_char_count: number; created_at: string }
interface DashData {
  user: { name: string; email: string }
  stats: Stats
  by_action: ActionItem[]
  by_provider: Record<string, number>
  top_domains: { domain: string; count: number }[]
  recent: LogItem[]
  pending_requests: number
  total_requests: number
  api_key_configured: boolean
  backend_url: string
}

const MODE_COLORS: Record<string, string> = {
  Enhance: 'rgba(124,58,237,0.15)',
  Professional: 'rgba(37,99,235,0.15)',
  Code: 'rgba(5,150,105,0.15)',
  Shorten: 'rgba(217,119,6,0.15)',
  Creative: 'rgba(225,29,72,0.15)',
}
const MODE_TEXT: Record<string, string> = {
  Enhance: 'var(--violet-light)', Professional: 'var(--blue-light)',
  Code: 'var(--emerald-light)', Shorten: 'var(--amber-light)', Creative: 'var(--rose-light)',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'rgba(217,119,6,0.12)',
  approved: 'rgba(5,150,105,0.12)',
  rejected: 'rgba(100,100,100,0.12)',
}
const STATUS_TEXT: Record<string, string> = {
  pending: 'var(--amber-light)',
  approved: 'var(--emerald-light)',
  rejected: 'var(--text-3)',
}

function useClock() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  useEffect(() => {
    function tick() {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`)
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      setDate(`${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return { time, date }
}

function timeSince(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { time, date } = useClock()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('stats-section')

  // Quick Enhance state
  const [enhanceText, setEnhanceText] = useState('')
  const [enhanceMode, setEnhanceMode] = useState('Enhance')
  const [enhanceResult, setEnhanceResult] = useState('')
  const [enhanceStatus, setEnhanceStatus] = useState('')
  const [enhanceLoading, setEnhanceLoading] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy')

  // Access Requests state
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({})
  const [actionMessage, setActionMessage] = useState('')

  const storedUser = getStoredUser()
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchStats() {
    try {
      const res = await api.dashboardStats()
      if (res.status === 401 || res.status === 403) { clearToken(); navigate('/login'); return }
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch { /* keep cached */ }
  }

  async function loadAccessRequests() {
    setRequestsLoading(true)
    try {
      const res = await api.adminAccessRequests()
      if (res.ok) {
        const d = await res.json()
        setAccessRequests(d.requests || [])
      }
    } catch { /* ignore */ }
    setRequestsLoading(false)
  }

  useEffect(() => {
    if (!storedUser) { navigate('/login'); return }

    api.dashboardStats().then(async res => {
      if (res.status === 401 || res.status === 403) { clearToken(); navigate('/login'); return }
      const d = await res.json()
      setData(d)
      setLoading(false)
    }).catch(() => setLoading(false))

    loadAccessRequests()

    refreshTimerRef.current = setInterval(fetchStats, 30000)
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [])

  async function handleLogout() {
    await api.logout().catch(() => {})
    clearToken()
    navigate('/')
  }

  async function runEnhance() {
    if (!enhanceText.trim()) return
    setEnhanceLoading(true)
    setEnhanceResult('')
    setEnhanceStatus('')
    try {
      const res = await api.adminEnhance(enhanceText, enhanceMode)
      const d = await res.json()
      if (d.enhanced) {
        setEnhanceResult(d.enhanced)
        setEnhanceStatus(`${d.chars_in} → ${d.chars_out} chars`)
      } else {
        setEnhanceStatus(d.error || 'Enhancement failed')
      }
    } catch {
      setEnhanceStatus('Network error')
    }
    setEnhanceLoading(false)
  }

  function copyResult() {
    navigator.clipboard.writeText(enhanceResult).then(() => {
      setCopyLabel('Copied!')
      setTimeout(() => setCopyLabel('Copy'), 2000)
    })
  }

  async function handleApprove(id: number) {
    setActionLoading(prev => ({ ...prev, [id]: true }))
    setActionMessage('')
    try {
      const res = await api.adminApproveRequest(id)
      const d = await res.json()
      if (res.ok) {
        setActionMessage(d.message || 'Approved!')
        loadAccessRequests()
        fetchStats()
      } else {
        setActionMessage(d.error || 'Approval failed')
      }
    } catch {
      setActionMessage('Network error')
    }
    setActionLoading(prev => ({ ...prev, [id]: false }))
  }

  async function handleReject(id: number) {
    setActionLoading(prev => ({ ...prev, [id]: true }))
    setActionMessage('')
    try {
      const res = await api.adminRejectRequest(id)
      const d = await res.json()
      if (res.ok) {
        setActionMessage(d.message || 'Rejected')
        loadAccessRequests()
        fetchStats()
      } else {
        setActionMessage(d.error || 'Rejection failed')
      }
    } catch {
      setActionMessage('Network error')
    }
    setActionLoading(prev => ({ ...prev, [id]: false }))
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--violet-light)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  const s = data?.stats
  const statsCards = [
    { label: 'Total Enhancements', value: s?.total ?? 0, sub: 'All time', accent: 'linear-gradient(90deg, #7c3aed, #a78bfa)', textColor: 'var(--violet-light)' },
    { label: 'Today', value: s?.today ?? 0, sub: `${s?.week ?? 0} this week`, accent: 'linear-gradient(90deg, #059669, #34d399)', textColor: 'var(--emerald-light)' },
    { label: 'This Month', value: s?.month ?? 0, sub: 'Last 30 days', accent: 'linear-gradient(90deg, #2563eb, #60a5fa)', textColor: 'var(--blue-light)' },
    { label: 'Daily Average', value: s?.avg_per_day ?? 0, sub: 'Per day (30d avg)', accent: 'linear-gradient(90deg, #d97706, #fbbf24)', textColor: 'var(--amber-light)' },
  ]

  const pendingCount = data?.pending_requests ?? 0
  const totalReqs = data?.total_requests ?? 0

  const navItems = [
    { id: 'stats-section', label: 'Dashboard', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    { id: 'enhance-section', label: 'Quick Enhance', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> },
    { id: 'activity-section', label: 'Activity Log', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id: 'requests-section', label: 'Access Requests', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: 'platforms-section', label: 'Downloads Hub', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg> },
  ]

  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--text-1)', fontSize: 13,
    fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, minWidth: 220, height: '100vh', position: 'sticky', top: 0,
        background: 'var(--sidebar)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ padding: '20px 16px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: 36, height: 36, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 0 20px rgba(124,58,237,0.5)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3 }}>PromptEnhancer</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>Admin Control Center</div>
          </div>
        </div>

        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 600, color: 'var(--violet-light)', lineHeight: 1, marginBottom: 4 }}>{time}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{date}</div>
        </div>

        <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 8px 4px', marginTop: 4 }}>Overview</div>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px',
                borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'transparent', border: 'none',
                cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left',
                color: activeSection === item.id ? 'var(--violet-light)' : 'var(--text-2)',
                backgroundColor: activeSection === item.id ? 'var(--violet-dim)' : 'transparent',
              }}
            >
              <span style={{ width: 16, height: 16, flexShrink: 0, opacity: activeSection === item.id ? 1 : 0.7 }}>{item.icon}</span>
              {item.label}
              {item.id === 'requests-section' && pendingCount > 0 && (
                <span style={{
                  marginLeft: 'auto', background: 'var(--amber-light)', color: '#000',
                  borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                }}>{pendingCount}</span>
              )}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px',
              borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'transparent',
              border: 'none', cursor: 'pointer', color: '#fb7185', marginTop: 8, width: '100%', textAlign: 'left',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </nav>

        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Gemini API', ok: data?.api_key_configured ?? false },
            { label: 'Database', ok: true },
            { label: 'Backend', ok: true },
          ].map(st => (
            <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: st.ok ? 'var(--emerald-light)' : 'var(--amber-light)',
                boxShadow: st.ok ? '0 0 8px rgba(52,211,153,0.6)' : '0 0 8px rgba(251,191,36,0.6)',
              }} />
              <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>{st.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace" }}>{st.ok ? 'OK' : 'Not set'}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, padding: '28px 28px 60px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 3 }}>
              Welcome back, {data?.user.name ?? storedUser?.name ?? 'Admin'} 👋
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              {' · '}{s?.total ?? 0} total enhancements
              {pendingCount > 0 && <> · <span style={{ color: 'var(--amber-light)', fontWeight: 600 }}>{pendingCount} pending request{pendingCount !== 1 ? 's' : ''}</span></>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={fetchStats} title="Refresh stats" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px',
              fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-3)', background: 'transparent', cursor: 'pointer',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Refresh
            </button>
            {pendingCount > 0 && (
              <button onClick={() => scrollTo('requests-section')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                fontSize: 13, fontWeight: 600, background: 'rgba(217,119,6,0.15)',
                color: 'var(--amber-light)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, cursor: 'pointer',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {pendingCount} Pending
              </button>
            )}
            <button onClick={() => scrollTo('enhance-section')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px',
              fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(124,58,237,0.35)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              Quick Enhance
            </button>
          </div>
        </div>

        {/* Stats */}
        <div id="stats-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {statsCards.map(c => (
            <div key={c.label} style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: c.accent }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{c.label}</div>
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6, color: c.textColor }}>{c.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Quick Enhance + Mode Breakdown */}
        <div id="enhance-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Quick Enhance */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--violet-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--violet-light)" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                </div>
                Quick Enhance
              </div>
              <span style={{ fontSize: 11, color: enhanceResult ? 'var(--emerald-light)' : 'var(--text-3)' }}>{enhanceStatus}</span>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {['Enhance','Professional','Code','Shorten','Creative'].map(m => (
                  <button key={m} onClick={() => setEnhanceMode(m)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    border: m === enhanceMode ? '1px solid rgba(124,58,237,0.4)' : '1px solid var(--border)',
                    background: m === enhanceMode ? 'var(--violet-dim)' : 'transparent',
                    color: m === enhanceMode ? 'var(--violet-light)' : 'var(--text-2)',
                  }}>{m}</button>
                ))}
              </div>
              <textarea
                value={enhanceText} onChange={e => setEnhanceText(e.target.value)}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runEnhance() } }}
                placeholder="Paste any text or prompt here... (Ctrl+Enter to enhance)"
                rows={4}
                style={{
                  width: '100%', minHeight: 100, background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px',
                  color: 'var(--text-1)', fontSize: 13, fontFamily: 'inherit',
                  resize: 'vertical', outline: 'none', marginBottom: 10, lineHeight: 1.6,
                }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={runEnhance} disabled={enhanceLoading} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                  fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  color: '#fff', border: 'none', borderRadius: 8, cursor: enhanceLoading ? 'not-allowed' : 'pointer',
                  opacity: enhanceLoading ? 0.6 : 1, fontFamily: 'inherit',
                }}>
                  {enhanceLoading ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Enhancing...</> : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Enhance</>)}
                </button>
                <button onClick={() => { setEnhanceText(''); setEnhanceResult(''); setEnhanceStatus('') }} style={{
                  padding: '5px 11px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)',
                  borderRadius: 6, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
                }}>Clear</button>
                <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>{enhanceText.length} chars</span>
              </div>
              {enhanceResult && (
                <div style={{
                  background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)',
                  borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.7,
                  color: 'var(--text-1)', whiteSpace: 'pre-wrap', marginTop: 10, position: 'relative',
                }}>
                  <button onClick={copyResult} style={{
                    position: 'absolute', top: 8, right: 8, background: 'rgba(124,58,237,0.15)',
                    border: '1px solid rgba(124,58,237,0.3)', color: 'var(--violet-light)',
                    borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{copyLabel}</button>
                  {enhanceResult}
                </div>
              )}
            </div>
          </div>

          {/* Usage by Mode */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(37,99,235,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue-light)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              Usage by Mode
            </div>
            <div style={{ padding: 20 }}>
              {data?.by_action.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.by_action.map(item => (
                    <div key={item.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{item.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.count} ({item.pct}%)</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--violet), var(--violet-light))', width: `${item.pct}%`, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                  No enhancement data yet.
                </div>
              )}
              {data?.by_provider && Object.keys(data.by_provider).length > 0 && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0 16px' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>By Provider</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {Object.entries(data.by_provider).map(([provider, count]) => (
                      <div key={provider} style={{
                        flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: 12, textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 18, marginBottom: 6 }}>{provider === 'groq' ? '⚡' : '✦'}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', marginBottom: 2 }}>{provider}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{count} uses</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div id="activity-section" style={{ marginBottom: 16 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(13,148,136,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal-light)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                Recent Activity
              </div>
              {data?.top_domains && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {data.top_domains.slice(0, 4).map(d => (
                    <span key={d.domain} style={{ fontSize: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, color: 'var(--text-3)' }}>
                      {d.domain} ({d.count})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              {data?.recent.length ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Mode','Provider','Model','Domain','Chars In','Chars Out','When'].map(h => (
                          <th key={h} style={{ textAlign: h === 'Chars In' || h === 'Chars Out' || h === 'When' ? 'right' : 'left', padding: '8px 12px', color: 'var(--text-3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((log, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: MODE_COLORS[log.action] || 'rgba(13,148,136,0.15)', color: MODE_TEXT[log.action] || 'var(--teal-light)' }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--text-2)', textTransform: 'capitalize' }}>{log.provider}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--text-2)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{log.model_used || '—'}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--text-3)' }}>{log.domain || '—'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-3)', fontFamily: "'JetBrains Mono', monospace" }}>{log.original_char_count}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-3)', fontFamily: "'JetBrains Mono', monospace" }}>{log.enhanced_char_count}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>{timeSince(log.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
                  No activity yet. Start enhancing prompts!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Access Requests */}
        <div id="requests-section" style={{ marginBottom: 16 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(217,119,6,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber-light)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                Access Requests
                {pendingCount > 0 && (
                  <span style={{
                    background: 'rgba(217,119,6,0.15)', color: 'var(--amber-light)',
                    border: '1px solid rgba(217,119,6,0.3)', borderRadius: 10,
                    padding: '2px 8px', fontSize: 11, fontWeight: 700,
                  }}>{pendingCount} pending</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{totalReqs} total</div>
                <button onClick={loadAccessRequests} style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  border: '1px solid var(--border)', borderRadius: 6, background: 'transparent',
                  color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit',
                }}>↻ Reload</button>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              {/* Action feedback message */}
              {actionMessage && (
                <div style={{
                  background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)',
                  borderRadius: 8, padding: '10px 14px', color: 'var(--emerald-light)',
                  fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  {actionMessage}
                  <button onClick={() => setActionMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--emerald-light)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              )}

              {accessRequests.length === 0 && !requestsLoading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
                  No access requests yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Name', 'Email', 'Reason', 'Status', 'Requested', 'Actions'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '7px 12px', color: 'var(--text-3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {accessRequests.map(req => (
                        <tr key={req.id} style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          background: req.status === 'pending' ? 'rgba(217,119,6,0.03)' : 'transparent',
                        }}>
                          <td style={{ padding: '10px 12px', color: 'var(--text-2)', fontWeight: 500 }}>{req.name || '—'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-1)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{req.email}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-3)', maxWidth: 200 }}>
                            <span title={req.reason} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                              {req.reason || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', padding: '3px 8px',
                              borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                              background: STATUS_COLOR[req.status] || 'rgba(100,100,100,0.12)',
                              color: STATUS_TEXT[req.status] || 'var(--text-3)',
                            }}>{req.status}</span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{timeSince(req.requested_at)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {req.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => handleApprove(req.id)}
                                  disabled={!!actionLoading[req.id]}
                                  style={{
                                    padding: '4px 10px', fontSize: 11, fontWeight: 700,
                                    border: '1px solid rgba(5,150,105,0.4)', borderRadius: 6,
                                    background: 'rgba(5,150,105,0.12)', color: 'var(--emerald-light)',
                                    cursor: actionLoading[req.id] ? 'not-allowed' : 'pointer',
                                    opacity: actionLoading[req.id] ? 0.6 : 1, fontFamily: 'inherit',
                                  }}
                                >
                                  {actionLoading[req.id] ? '...' : '✓ Approve'}
                                </button>
                                <button
                                  onClick={() => handleReject(req.id)}
                                  disabled={!!actionLoading[req.id]}
                                  style={{
                                    padding: '4px 10px', fontSize: 11, fontWeight: 700,
                                    border: '1px solid rgba(225,29,72,0.3)', borderRadius: 6,
                                    background: 'rgba(225,29,72,0.08)', color: '#fb7185',
                                    cursor: actionLoading[req.id] ? 'not-allowed' : 'pointer',
                                    opacity: actionLoading[req.id] ? 0.6 : 1, fontFamily: 'inherit',
                                  }}
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                {req.processed_at ? timeSince(req.processed_at) : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {requestsLoading && (
                    <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.12)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--violet-light)', marginBottom: 6 }}>How approval works</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Clicking <strong style={{ color: 'var(--text-2)' }}>Approve</strong> creates a user account and emails them their login credentials automatically.
                  They can then use the Chrome extension with their own free API key.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Downloads Hub */}
        <div id="platforms-section" style={{ marginBottom: 16 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(5,150,105,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--emerald-light)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
                </div>
                Downloads Hub
              </div>
              <a href="https://github.com/yokesh-kumar-M/PromptEnhancer/releases" target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px',
                fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)',
              }}>View GitHub Releases</a>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  {
                    icon: '🧩', name: 'Chrome Extension',
                    desc: 'Works on ChatGPT, Claude, Gemini & any website. Floating ✨ button on AI chat inputs.',
                    steps: ['Download zip from GitHub Releases', 'chrome://extensions → Developer Mode → Load Unpacked', 'Add your free Groq or Gemini API key in Settings'],
                    href: 'https://github.com/yokesh-kumar-M/PromptEnhancer/releases',
                  },
                  {
                    icon: '💻', name: 'VS Code Extension',
                    desc: 'Enhance selected text inside your editor. Ctrl+Shift+E to enhance, Ctrl+Shift+K for code prompts.',
                    steps: ['Download .vsix from GitHub Releases', 'VS Code → Extensions → ⋯ → Install from VSIX', 'Run "Set Gemini API Key" command'],
                    href: 'https://github.com/yokesh-kumar-M/PromptEnhancer/releases',
                  },
                  {
                    icon: '⌨️', name: 'CLI (Antigravity)',
                    desc: 'Enhance from any terminal. Pipe input, clipboard output, all 5 modes via pe "prompt".',
                    steps: ['Download CLI zip from GitHub Releases', 'Set GROQ_API_KEY or GEMINI_API_KEY env var', 'python enhance.py "your prompt"'],
                    href: 'https://github.com/yokesh-kumar-M/PromptEnhancer/releases',
                  },
                ].map(p => (
                  <div key={p.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 26, marginBottom: 10 }}>{p.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 12, flex: 1 }}>{p.desc}</div>
                    <div style={{ marginBottom: 12 }}>
                      {p.steps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5 }}>
                          <span style={{ width: 16, height: 16, flexShrink: 0, background: 'rgba(124,58,237,0.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--violet-light)', marginTop: 1 }}>{i + 1}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>{step}</span>
                        </div>
                      ))}
                    </div>
                    <a href={p.href} target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                      fontSize: 11, fontWeight: 600, background: 'rgba(124,58,237,0.12)',
                      color: 'var(--violet-light)', border: '1px solid rgba(124,58,237,0.25)',
                      borderRadius: 6,
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                      Download
                    </a>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-2)' }}>Backend API Endpoint</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--violet-light)', background: 'rgba(124,58,237,0.08)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(124,58,237,0.2)', marginBottom: 10 }}>
                  {data?.backend_url || 'https://promptenhancer-backend.onrender.com'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-3)' }}>
                  <span>POST /api/enhance/</span><span>·</span>
                  <span>POST /api/log-usage/</span><span>·</span>
                  <span>POST /api/verify-key/</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
