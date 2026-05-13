import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function RequestAccess() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.requestAccess({ name, email, reason })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Submission failed')
      } else {
        setSubmitted(true)
        setMessage(data.message || 'Request submitted!')
      }
    } catch {
      setError('Network error — please try again')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(3,3,5,0.85)', backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 24px',
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(124,58,237,0.4)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>PromptEnhancer Pro</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/login" style={{ padding: '6px 13px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)' }}>Sign In</Link>
          </div>
        </div>
      </nav>

      <section className="animate-fade-up" style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px', boxShadow: '0 0 40px rgba(124,58,237,0.4)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>Request Access</h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto' }}>
            Submit your request and the admin will review it. Once approved, you'll receive login credentials by email.
          </p>
        </div>

        {submitted ? (
          <>
            <div style={{
              background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)',
              borderRadius: 14, padding: 28, textAlign: 'center', marginBottom: 24,
            }}>
              <div style={{
                width: 52, height: 52, background: 'rgba(5,150,105,0.15)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--emerald-light)" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--emerald-light)' }}>Request Submitted!</div>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{message}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Link to="/" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)',
              }}>← Back to Home</Link>
            </div>
          </>
        ) : (
          <>
            {error && (
              <div style={{
                background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)',
                borderRadius: 8, padding: '11px 14px', color: '#fda4af', fontSize: 13, marginBottom: 20,
              }}>{error}</div>
            )}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28 }}>
              <form onSubmit={handleSubmit}>
                {([
                  { id: 'name', label: 'Your Name', type: 'text', placeholder: 'Your full name', required: false, val: name, set: setName },
                  { id: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com', required: true, val: email, set: setEmail },
                ] as const).map(f => (
                  <div key={f.id} style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                      {f.label}{f.required && <span style={{ color: '#fb7185' }}> *</span>}
                    </label>
                    <input
                      type={f.type} value={f.val}
                      onChange={e => (f.set as (v: string) => void)(e.target.value)}
                      placeholder={f.placeholder} required={f.required}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border)', borderRadius: 9,
                        padding: '11px 14px', color: 'var(--text-1)', fontSize: 14,
                        fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                    {f.id === 'email' && (
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>Your login credentials will be sent to this address once approved.</p>
                    )}
                  </div>
                ))}

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                    How will you use it? <span style={{ color: 'var(--text-3)', textTransform: 'none', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="I work on AI research and want to improve my prompts for..."
                    rows={3}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border)', borderRadius: 9,
                      padding: '11px 14px', color: 'var(--text-1)', fontSize: 14,
                      fontFamily: 'inherit', outline: 'none', resize: 'vertical', minHeight: 76,
                    }}
                  />
                </div>

                <button
                  type="submit" disabled={loading}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 13, background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                    color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                    border: 'none', borderRadius: 9, cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 20px rgba(124,58,237,0.35)', opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? 'Submitting…' : 'Submit Request →'}
                </button>
              </form>
            </div>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'var(--violet-light)', fontWeight: 500 }}>Sign in →</Link>
              </p>
            </div>
          </>
        )}
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', marginTop: 'auto', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Admin-approved · BYOK · Multi-platform AI prompt enhancer</p>
      </footer>
    </div>
  )
}
