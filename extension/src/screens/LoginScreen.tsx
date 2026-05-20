import { useState } from 'react';
import { Sparkles, Eye, EyeOff, ExternalLink, LogIn, Mail, AlertCircle, Clock } from 'lucide-react';
import { loginExtension, checkAccess } from '../lib/api';
import {
  applyAppearance,
  saveAuth,
  saveCloudSettingsLocal,
  setPendingEmail,
  clearPendingEmail,
} from '../lib/storage';
import { FRONTEND_URL } from '../lib/constants';
import type { AuthState } from '../lib/types';

interface Props {
  onAuthenticated: (state: AuthState) => void;
  initialEmail?: string;
}

export function LoginScreen({ onAuthenticated, initialEmail = '' }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAccess, setCheckingAccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginExtension(email.trim().toLowerCase(), password);
      await saveAuth(res.token, res.user);
      await saveCloudSettingsLocal(res.settings);
      await clearPendingEmail();
      applyAppearance(res.settings.theme, res.settings.density);
      onAuthenticated({ status: 'authenticated', token: res.token, user: res.user, pendingEmail: '' });
    } catch (err: unknown) {
      const e = err as { status?: number; payload?: { pending?: boolean; access_status?: string }; message?: string };
      if (e.payload?.pending) {
        await setPendingEmail(email.trim().toLowerCase());
        onAuthenticated({ status: 'pending', token: '', user: null, pendingEmail: email.trim().toLowerCase() });
        return;
      }
      setError(e.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const lookupAccess = async () => {
    if (!email.trim()) return;
    setCheckingAccess(true);
    setError('');
    try {
      const r = await checkAccess(email.trim().toLowerCase());
      if (r.status === 'pending') {
        await setPendingEmail(email.trim().toLowerCase());
        onAuthenticated({ status: 'pending', token: '', user: null, pendingEmail: email.trim().toLowerCase() });
      } else if (r.status === 'rejected') {
        setError('Your access request was rejected. Contact the admin.');
      } else if (r.status === 'approved' && !r.has_account) {
        setError('Approved — but no account yet. Check your email for credentials.');
      } else if (r.status === 'none') {
        setError('No request found. Click "Request access" below.');
      } else {
        setError('Account exists — enter your password to log in.');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Could not check status.');
    } finally {
      setCheckingAccess(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="header-icon-wrap auth-hero-icon">
          <Sparkles className="header-icon" strokeWidth={1.5} />
        </div>
        <h1 className="auth-title">PromptEnhancer Pro</h1>
        <p className="auth-subtitle">Sign in to sync history, templates & settings across devices.</p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <div className="auth-field">
          <label className="auth-label">Email</label>
          <div className="auth-input-wrap">
            <Mail style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            <input
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              spellCheck={false}
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label">Password</label>
          <div className="auth-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              className="auth-input"
              placeholder="Your account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="button" className="auth-eye" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
              {showPassword ? <EyeOff style={{ width: 14, height: 14 }} strokeWidth={1.5} /> : <Eye style={{ width: 14, height: 14 }} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading || !email || !password}>
          {loading ? 'Signing in…' : <><LogIn style={{ width: 14, height: 14 }} strokeWidth={2} /> Sign In</>}
        </button>
      </form>

      <div className="auth-divider"><span>or</span></div>

      <div className="auth-secondary">
        <button
          type="button"
          className="btn-ghost"
          onClick={lookupAccess}
          disabled={!email.trim() || checkingAccess}
        >
          <Clock style={{ width: 14, height: 14 }} strokeWidth={1.5} />
          {checkingAccess ? 'Checking…' : 'Check approval status'}
        </button>

        <a
          href={`${FRONTEND_URL}/request-access`}
          target="_blank"
          rel="noopener noreferrer"
          className="auth-link"
        >
          <ExternalLink style={{ width: 12, height: 12 }} strokeWidth={1.5} />
          Don't have an account? Request access →
        </a>
      </div>

      <div className="auth-footnote">
        Access is admin-approved. You can also use the extension without logging in —
        history & settings will stay device-local.
      </div>
    </div>
  );
}

interface PendingProps {
  email: string;
  onSignInAnyway: () => void;
  onBackToLogin: () => void;
}

export function ApprovalPending({ email, onSignInAnyway, onBackToLogin }: PendingProps) {
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const refresh = async () => {
    setChecking(true);
    setStatusMsg('');
    try {
      const r = await checkAccess(email);
      if (r.has_account || r.status === 'approved') {
        setStatusMsg('Approved! Check your email for credentials, then sign in.');
      } else if (r.status === 'rejected') {
        setStatusMsg('Your request was rejected.');
      } else if (r.status === 'pending') {
        setStatusMsg('Still pending. The admin will email you when approved.');
      } else {
        setStatusMsg('No active request — please re-submit.');
      }
    } catch {
      setStatusMsg('Could not check status. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="header-icon-wrap auth-hero-icon" style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' }}>
          <Clock className="header-icon" style={{ color: '#F59E0B' }} strokeWidth={1.5} />
        </div>
        <h1 className="auth-title">Awaiting Approval</h1>
        <p className="auth-subtitle">
          Your request for <strong style={{ color: '#A78BFA' }}>{email}</strong> is pending admin review.
          You'll get an email with login credentials once approved.
        </p>
      </div>

      {statusMsg && (
        <div className="auth-error" style={{ background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)', color: '#E4E4E7' }}>
          <AlertCircle style={{ width: 14, height: 14, color: '#A78BFA', flexShrink: 0 }} strokeWidth={1.5} />
          <span>{statusMsg}</span>
        </div>
      )}

      <div className="auth-actions-stack">
        <button className="btn-primary" onClick={refresh} disabled={checking}>
          {checking ? 'Checking…' : 'Refresh status'}
        </button>
        <button className="btn-ghost" onClick={onSignInAnyway}>
          I have credentials — sign in →
        </button>
        <button className="btn-ghost-muted" onClick={onBackToLogin}>Use a different email</button>
      </div>

      <div className="auth-footnote">
        Can't wait? You can still use the extension with your own Groq/Gemini API key — just skip login and configure it in Settings.
      </div>
    </div>
  );
}
