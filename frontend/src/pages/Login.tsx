import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, saveToken, saveUser } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login(email, password)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
      } else {
        saveToken(data.token)
        saveUser(data.user)
        navigate(data.user.is_staff ? '/dashboard' : '/')
      }
    } catch {
      setError('Network error — please try again')
    }
    setLoading(false)
  }

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      background: 'var(--bg)', color: 'var(--text-1)',
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      position: 'relative',
    }}>
      <div style={{
        position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
      }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 400 }}>
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text-3)', marginBottom: 24, textDecoration: 'none',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to home
        </Link>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px', boxShadow: '0 0 40px rgba(124,58,237,0.4)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)', marginBottom: 16, letterSpacing: '0.02em' }}>
            PromptEnhancer Pro
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>Sign in to your account</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)',
            borderRadius: 8, padding: '11px 14px', color: '#fda4af',
            fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Email Address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)', borderRadius: 9,
                  padding: '12px 14px', color: 'var(--text-1)', fontSize: 14,
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)', borderRadius: 9,
                  padding: '12px 14px', color: 'var(--text-1)', fontSize: 14,
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 13, background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                border: 'none', borderRadius: 9, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(124,58,237,0.35)', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Signing in…' : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6 }}>
            Don't have an account?{' '}
            <Link to="/request-access" style={{ color: 'var(--violet-light)', fontWeight: 500 }}>Request access →</Link>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Have an invite code?{' '}
            <Link to="/register" style={{ color: 'var(--violet-light)', fontWeight: 500 }}>Register →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
