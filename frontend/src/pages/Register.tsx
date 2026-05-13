import { Link } from 'react-router-dom'

export default function Register() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'var(--bg)', color: 'var(--text-1)', position: 'relative',
    }}>
      <div style={{
        position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
      }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text-3)', marginBottom: 32,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to home
        </Link>

        <div style={{
          width: 56, height: 56,
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', boxShadow: '0 0 40px rgba(124,58,237,0.4)',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
          Accounts are Admin-Created
        </h1>

        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 32 }}>
          PromptEnhancer Pro uses admin-approved access. Request access and the admin will create your account and email you your login credentials.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/request-access" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px 24px', fontSize: 15, fontWeight: 700, borderRadius: 10,
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
            boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Request Access
          </Link>

          <Link to="/login" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 24px', fontSize: 14, fontWeight: 600, borderRadius: 10,
            border: '1px solid var(--border)', color: 'var(--text-2)',
          }}>
            Already have an account? Sign In →
          </Link>
        </div>
      </div>
    </div>
  )
}
