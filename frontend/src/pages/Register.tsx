import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, saveToken, saveUser } from '../lib/api'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [inviteCode, setInviteCode] = useState(searchParams.get('code') || '')
  const [inviteValid, setInviteValid] = useState<boolean | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setInviteCode(code)
      validateCode(code)
    }
  }, [])

  async function validateCode(code: string) {
    if (!code.trim()) { setInviteValid(null); return }
    try {
      const res = await api.validateInvite(code.trim())
      const data = await res.json()
      setInviteValid(data.valid === true)
    } catch {
      setInviteValid(null)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.register({ invite_code: inviteCode, name, email, password })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
      } else {
        saveToken(data.token)
        saveUser(data.user)
        navigate('/dashboard')
      }
    } catch {
      setError('Network error — please try again')
    }
    setLoading(false)
  }

  return (
    <div style={{
      background: 'var(--bg)', color: 'var(--text-1)',
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      position: 'relative',
    }}>
      <div style={{
        position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)',
      }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 440 }}>
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text-3)', marginBottom: 24,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to home
        </Link>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 54, height: 54, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 0 40px rgba(124,58,237,0.4)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Create Your Account</h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>Use the invite code from your approval email.</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)',
            borderRadius: 8, padding: '11px 14px', color: '#fda4af', fontSize: 13, marginBottom: 20,
          }}>{error}</div>
        )}

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                Invite Code <span style={{ color: '#fb7185' }}>*</span>
              </label>
              <input
                type="text" value={inviteCode}
                onChange={e => { setInviteCode(e.target.value); validateCode(e.target.value) }}
                placeholder="XXXXXXXX-XXXX-XXXX" required spellCheck={false} autoComplete="off"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)', borderRadius: 9,
                  padding: '11px 14px', color: 'var(--text-1)', fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', outline: 'none',
                }}
              />
              {inviteValid === true && (
                <p style={{ fontSize: 11, marginTop: 5, color: 'var(--emerald-light)' }}>✓ Valid invite code</p>
              )}
              {inviteValid === false && (
                <p style={{ fontSize: 11, marginTop: 5, color: 'var(--rose-light)' }}>✗ Invalid invite code</p>
              )}
              {inviteValid === null && (
                <p style={{ fontSize: 11, marginTop: 5, color: 'var(--text-3)' }}>Check the invite email sent to your address.</p>
              )}
            </div>

            {(['name', 'email', 'password'] as const).map(field => (
              <div key={field} style={{ marginBottom: field === 'password' ? 24 : 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                  {field === 'name' ? 'Full Name' : field === 'email' ? 'Email Address' : 'Password'}{' '}
                  <span style={{ color: '#fb7185' }}>*</span>
                </label>
                <input
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={field === 'name' ? name : field === 'email' ? email : password}
                  onChange={e => field === 'name' ? setName(e.target.value) : field === 'email' ? setEmail(e.target.value) : setPassword(e.target.value)}
                  placeholder={field === 'name' ? 'Your Name' : field === 'email' ? 'you@example.com' : 'At least 8 characters'}
                  required
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border)', borderRadius: 9,
                    padding: '11px 14px', color: 'var(--text-1)', fontSize: 14,
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
                {field === 'password' && (
                  <p style={{ fontSize: 11, marginTop: 5, color: 'var(--text-3)' }}>Minimum 8 characters.</p>
                )}
              </div>
            ))}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 13, background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                border: 'none', borderRadius: 9, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(124,58,237,0.35)', opacity: loading ? 0.7 : 1, marginTop: 8,
              }}
            >
              {loading ? 'Creating account…' : 'Create Account & Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 5 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--violet-light)', fontWeight: 500 }}>Sign in →</Link>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Need an invite?{' '}
            <Link to="/request-access" style={{ color: 'var(--violet-light)', fontWeight: 500 }}>Request access →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
