import { useState, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, saveToken, saveUser } from '../lib/api'

const GITHUB_RELEASES = 'https://github.com/yokesh-kumar-M/PromptEnhancer/releases'
const BACKEND_URL = 'https://promptenhancer-backend.onrender.com'

const setupSteps = [
  {
    num: '1',
    title: 'Download Chrome Extension',
    desc: 'Get the latest build from GitHub Releases.',
    link: { href: GITHUB_RELEASES, label: 'Download from GitHub Releases →' },
  },
  {
    num: '2',
    title: 'Load in Chrome',
    desc: 'Go to chrome://extensions → Enable "Developer mode" → "Load unpacked" → select the extracted extension folder.',
  },
  {
    num: '3',
    title: 'Enter Your Invite Code',
    desc: 'Click the extension icon in your toolbar → type your invite code and click Validate Code.',
  },
  {
    num: '4',
    title: 'Set Backend URL',
    desc: 'Go to the Settings tab inside the extension → under "Backend Server URL" paste:',
    code: BACKEND_URL,
  },
  {
    num: '5',
    title: 'Add Your Free API Key',
    desc: 'Still in Settings → choose Groq (14,400 req/day free) or Gemini (free) → paste your API key.',
    links: [
      { href: 'https://console.groq.com/keys', label: '⚡ Get free Groq API key →' },
      { href: 'https://aistudio.google.com/apikey', label: '✦ Get free Gemini API key →' },
    ],
  },
  {
    num: '6',
    title: 'Start Enhancing!',
    desc: 'Open any AI chat (ChatGPT, Claude, Gemini…) — click the ✨ button on the text input, pick a mode and your prompt is instantly transformed.',
  },
]

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillCode = searchParams.get('code') || ''

  const [inviteCode, setInviteCode] = useState(prefillCode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.register({ invite_code: inviteCode.trim(), name, email, password })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
      } else {
        saveToken(data.token)
        saveUser(data.user)
        if (data.user.is_staff) {
          navigate('/dashboard')
        } else {
          setSuccess(true)
        }
      }
    } catch {
      setError('Network error — please try again')
    }
    setLoading(false)
  }

  function copyBackendUrl() {
    navigator.clipboard.writeText(BACKEND_URL).then(() => {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    })
  }

  if (success) {
    return (
      <div style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        background: 'var(--bg)', color: 'var(--text-1)',
        minHeight: '100vh', padding: '48px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 580 }}>
          {/* Success header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64, background: 'rgba(5,150,105,0.15)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', boxShadow: '0 0 40px rgba(5,150,105,0.2)',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--emerald-light)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>Account Created!</h1>
            <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
              Welcome to PromptEnhancer Pro. Follow these steps to set up the Chrome extension with your invite code.
            </p>
          </div>

          {/* Setup steps */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 22, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Extension Setup Guide
            </div>
            {setupSteps.map((step, i) => (
              <div key={step.num} style={{ display: 'flex', gap: 14, marginBottom: i < setupSteps.length - 1 ? 20 : 0 }}>
                <div style={{
                  width: 28, height: 28, flexShrink: 0,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: '#fff',
                }}>{step.num}</div>
                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{step.desc}</div>
                  {step.code && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <div style={{
                        flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                        color: 'var(--violet-light)', background: 'rgba(124,58,237,0.08)',
                        border: '1px solid rgba(124,58,237,0.2)', padding: '7px 12px', borderRadius: 7,
                      }}>{step.code}</div>
                      <button
                        onClick={copyBackendUrl}
                        style={{
                          padding: '7px 12px', fontSize: 12, fontWeight: 600, flexShrink: 0,
                          border: '1px solid var(--border)', borderRadius: 7, background: 'transparent',
                          color: copiedUrl ? 'var(--emerald-light)' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >{copiedUrl ? '✓ Copied' : 'Copy'}</button>
                    </div>
                  )}
                  {step.link && (
                    <a href={step.link.href} target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
                      fontSize: 12, color: 'var(--violet-light)', fontWeight: 500,
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      {step.link.label}
                    </a>
                  )}
                  {step.links && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                      {step.links.map(l => (
                        <a key={l.href} href={l.href} target="_blank" rel="noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 12, color: 'var(--violet-light)', fontWeight: 500,
                        }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <a href={GITHUB_RELEASES} target="_blank" rel="noreferrer" style={{
              flex: 1, minWidth: 160, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 18px', fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
              borderRadius: 9, boxShadow: '0 2px 12px rgba(124,58,237,0.35)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
              Download Extension
            </a>
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{
              flex: 1, minWidth: 140, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 18px', fontSize: 13, fontWeight: 600,
              border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 9,
            }}>⚡ Get Groq Key</a>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{
              flex: 1, minWidth: 140, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 18px', fontSize: 13, fontWeight: 600,
              border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 9,
            }}>✦ Get Gemini Key</a>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link to="/" style={{ fontSize: 13, color: 'var(--text-3)' }}>← Back to Home</Link>
          </div>
        </div>
      </div>
    )
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)', borderRadius: 9,
    padding: '12px 14px', color: 'var(--text-1)', fontSize: 14,
    fontFamily: 'inherit', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
  }

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      background: 'var(--bg)', color: 'var(--text-1)',
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative',
    }}>
      <div style={{
        position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
      }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 420 }}>
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text-3)', marginBottom: 24,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back to home
        </Link>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px', boxShadow: '0 0 40px rgba(124,58,237,0.4)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)', marginBottom: 12, letterSpacing: '0.02em' }}>PromptEnhancer Pro</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Create Account</h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>Register with your invite code</p>
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
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Invite Code</label>
              <input
                type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                placeholder="Your personal invite code" required autoFocus
                style={{ ...fieldStyle, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>From your approval email.</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={fieldStyle} />
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>Minimum 8 characters.</p>
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
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--violet-light)', fontWeight: 500 }}>Sign in →</Link>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
            No invite code?{' '}
            <Link to="/request-access" style={{ color: 'var(--violet-light)', fontWeight: 500 }}>Request access →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
