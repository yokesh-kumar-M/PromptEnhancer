import { Link } from 'react-router-dom'
import { getStoredUser } from '../lib/api'

const platforms = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Copilot', 'Mistral', 'Poe', 'Any website']

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--violet-light)" strokeWidth="1.5">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      </svg>
    ),
    bg: 'rgba(124,58,237,0.12)',
    title: '5 Enhancement Modes',
    desc: 'Enhance, Professional, Shorten, Code, Creative — one click transforms any text into a powerful, structured AI instruction.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue-light)" strokeWidth="1.5">
        <rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" />
      </svg>
    ),
    bg: 'rgba(37,99,235,0.12)',
    title: 'Bring Your Own API Key',
    desc: "Use your free Groq or Gemini API key. No subscriptions. Groq's free tier provides 14,400 requests/day.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--emerald-light)" strokeWidth="1.5">
        <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" />
      </svg>
    ),
    bg: 'rgba(5,150,105,0.12)',
    title: 'Admin Analytics Dashboard',
    desc: 'Track every enhancement — total count, by mode, by provider, top domains. Full visibility into your prompt workflow.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--amber-light)" strokeWidth="1.5">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    bg: 'rgba(217,119,6,0.12)',
    title: 'Chrome + VS Code + CLI',
    desc: 'Works everywhere — Chrome extension for AI chats, VS Code for coding, Python CLI (Antigravity) for terminal power users.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rose-light)" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    bg: 'rgba(225,29,72,0.12)',
    title: 'Admin-Approved Access',
    desc: 'Request access and get approved by admin. Receive login credentials by email and start enhancing immediately.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal-light)" strokeWidth="1.5">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      </svg>
    ),
    bg: 'rgba(13,148,136,0.12)',
    title: '15+ Prompt Templates',
    desc: 'Built-in shortcuts: //code, //debug, //email, //tweet and more. Type them anywhere to insert optimized prompt starters.',
  },
]

export default function Landing() {
  const user = getStoredUser()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(3,3,5,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 24px',
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
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
            {user ? (
              <>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{user.name}</span>
                {user.is_staff && (
                  <Link to="/dashboard" style={{
                    padding: '6px 13px', fontSize: 13, fontWeight: 600,
                    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)',
                  }}>Dashboard</Link>
                )}
              </>
            ) : (
              <>
                <Link to="/login" style={{
                  padding: '6px 13px', fontSize: 13, fontWeight: 600,
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)',
                }}>Sign In</Link>
                <Link to="/request-access" style={{
                  padding: '6px 13px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
                  boxShadow: '0 2px 12px rgba(124,58,237,0.35)',
                }}>Request Access</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 1100, margin: '0 auto', padding: '96px 24px 72px',
        textAlign: 'center', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 500, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.1) 0%, transparent 70%)',
        }} />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)',
          color: 'var(--violet-light)', padding: '6px 14px', borderRadius: 20,
          fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 28,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
          Admin-Approved · BYOK · Multi-Platform
        </div>

        <h1 style={{
          fontSize: 'clamp(42px,7vw,72px)', fontWeight: 900, lineHeight: 1.05,
          letterSpacing: '-0.04em', marginBottom: 22,
        }}>
          Supercharge Every<br />
          <span className="gradient-text">AI Prompt — Instantly</span>
        </h1>

        <p style={{
          fontSize: 'clamp(16px,2vw,19px)', color: 'var(--text-2)',
          maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.65,
        }}>
          Transform vague requests into powerful, structured AI instructions.
          Works on ChatGPT, Claude, Gemini and every major AI platform.
          No subscription — use your own free API key.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          <Link to="/request-access" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '13px 28px', fontSize: 15, fontWeight: 600, borderRadius: 10,
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
            boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Request Access
          </Link>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '13px 28px', fontSize: 15, fontWeight: 600, borderRadius: 10,
            border: '1px solid var(--border)', color: 'var(--text-2)',
          }}>Sign In →</Link>
        </div>
      </section>

      {/* Platforms */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 72px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 18 }}>
          Works on all major AI platforms
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 20px' }}>
          {platforms.map(p => (
            <span key={p} style={{ fontSize: 13, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 4, height: 4, background: 'var(--text-3)', borderRadius: '50%', display: 'inline-block' }} />
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(26px,4vw,36px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>
          Everything you need for better AI prompts
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 15, marginBottom: 44 }}>
          Five intelligent modes. Multi-platform. Zero subscriptions.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, padding: 26, transition: 'border-color 0.2s, transform 0.2s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11, background: f.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(26px,4vw,36px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 48 }}>
          Up and running in 3 steps
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', maxWidth: 760, margin: '0 auto' }}>
          {[
            { num: '1', title: 'Request Access', desc: 'Submit your email. Admin reviews and approves — you receive login credentials directly.' },
            { num: '2', title: 'Set Up in 2 Minutes', desc: 'Log in, install the Chrome extension, and add your free Groq or Gemini API key.' },
            { num: '3', title: 'Enhance Every Prompt', desc: 'Click ✨ on any AI chat. Pick your mode. Watch your prompt transform instantly.' },
          ].map(s => (
            <div key={s.num} style={{ textAlign: 'center', padding: '0 28px' }}>
              <div style={{
                width: 52, height: 52,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px', fontSize: 20, fontWeight: 800, color: '#fff',
                boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
              }}>{s.num}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(79,70,229,0.06))',
          border: '1px solid rgba(124,58,237,0.15)', borderRadius: 20, padding: '52px 36px',
          textAlign: 'center', boxShadow: '0 0 80px rgba(124,58,237,0.08)',
        }}>
          <h2 style={{ fontSize: 'clamp(24px,3vw,32px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 14 }}>
            Ready to write better AI prompts?
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 460, margin: '0 auto 30px', lineHeight: 1.6 }}>
            Admin-approved access. BYOK means no subscriptions — just unlimited, fast AI enhancement with your own free API key.
          </p>
          <Link to="/request-access" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '13px 28px', fontSize: 15, fontWeight: 600, borderRadius: 10,
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
            boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
          }}>
            Request Access →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', marginTop: 'auto', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 22, height: 22, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>PromptEnhancer Pro</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Admin-approved · BYOK · Multi-platform AI prompt enhancer</p>
      </footer>
    </div>
  )
}
