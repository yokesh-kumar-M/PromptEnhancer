import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, ExternalLink, Check, X, AlertCircle,
  Sun, Moon, Monitor, Server, Palette, Bot, LogOut, User as UserIcon, RefreshCw,
} from 'lucide-react';
import type { CloudSettings, LocalSettings, Provider, Theme, Density, User } from '../lib/types';
import { MODELS_FOR, FRONTEND_URL } from '../lib/constants';

interface Props {
  user: User | null;
  cloudSettings: CloudSettings;
  localSettings: LocalSettings;
  onCloudPatch: (patch: Partial<CloudSettings>) => Promise<void>;
  onLocalPatch: (patch: Partial<LocalSettings>) => Promise<void>;
  onVerifyKey: (provider: Provider, apiKey: string) => Promise<{ valid: boolean; error?: string }>;
  onLogout: () => Promise<void>;
  onOpenLogin: () => void;
  onResyncFromCloud: () => Promise<void>;
}

export function SettingsTab(props: Props) {
  const { user, cloudSettings, localSettings, onCloudPatch, onLocalPatch, onVerifyKey, onLogout, onOpenLogin, onResyncFromCloud } = props;

  const [keyInput, setKeyInput] = useState(
    cloudSettings.preferred_provider === 'groq' ? cloudSettings.groq_api_key : cloudSettings.gemini_api_key
  );
  const [showKey, setShowKey] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [verifyMsg, setVerifyMsg] = useState('');
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [backendUrlInput, setBackendUrlInput] = useState(localSettings.backendUrl);
  const [resyncing, setResyncing] = useState(false);

  const flash = (key: string) => {
    setSavedFlash(key);
    setTimeout(() => setSavedFlash(null), 1500);
  };

  const switchProvider = async (p: Provider) => {
    await onCloudPatch({ preferred_provider: p, preferred_model: '' });
    setKeyInput(p === 'groq' ? cloudSettings.groq_api_key : cloudSettings.gemini_api_key);
    setVerifyStatus('idle');
    setVerifyMsg('');
  };

  const verify = async () => {
    if (!keyInput.trim()) return;
    setVerifyStatus('loading');
    setVerifyMsg('');
    const result = await onVerifyKey(cloudSettings.preferred_provider, keyInput.trim());
    if (result.valid) {
      setVerifyStatus('ok');
      setVerifyMsg('Valid key');
    } else {
      setVerifyStatus('error');
      setVerifyMsg(result.error || 'Invalid');
    }
    setTimeout(() => { setVerifyStatus('idle'); setVerifyMsg(''); }, 4000);
  };

  const saveKey = async () => {
    const patch: Partial<CloudSettings> = cloudSettings.preferred_provider === 'groq'
      ? { groq_api_key: keyInput.trim() }
      : { gemini_api_key: keyInput.trim() };
    await onCloudPatch(patch);
    flash('apikey');
  };

  const saveBackendUrl = async () => {
    const url = backendUrlInput.trim().replace(/\/$/, '');
    if (!url) return;
    await onLocalPatch({ backendUrl: url });
    setBackendUrlInput(url);
    flash('backend');
  };

  const resync = async () => {
    setResyncing(true);
    try { await onResyncFromCloud(); flash('resync'); } finally { setResyncing(false); }
  };

  const themeBtn = (value: Theme, label: string, icon: React.ReactNode) => (
    <button
      key={value}
      className={`seg-btn ${cloudSettings.theme === value ? 'seg-btn-active' : ''}`}
      onClick={() => onCloudPatch({ theme: value })}
    >
      {icon}
      {label}
    </button>
  );

  const densityBtn = (value: Density, label: string) => (
    <button
      key={value}
      className={`seg-btn ${cloudSettings.density === value ? 'seg-btn-active' : ''}`}
      onClick={() => onCloudPatch({ density: value })}
    >
      {label}
    </button>
  );

  return (
    <motion.div key="settings" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
      {/* Account */}
      <div className="card">
        <div className="card-label" style={{ marginBottom: 6 }}>
          <UserIcon style={{ width: 13, height: 13, color: '#A78BFA' }} strokeWidth={1.7} />
          Account
        </div>
        {user ? (
          <>
            <div className="account-row">
              <div className="header-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{user.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
              {user.is_staff && <span className="badge badge-admin">Admin</span>}
            </div>
            <div className="account-actions">
              <a href={`${FRONTEND_URL}${user.is_staff ? '/dashboard' : '/'}`} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ flex: 1 }}>
                <ExternalLink style={{ width: 12, height: 12 }} strokeWidth={1.7} />
                Open Dashboard
              </a>
              <button className="btn-ghost-muted" onClick={resync} disabled={resyncing}>
                <RefreshCw style={{ width: 12, height: 12 }} strokeWidth={1.7} className={resyncing ? 'spin' : ''} />
                {savedFlash === 'resync' ? 'Synced' : 'Resync'}
              </button>
              <button className="btn-ghost-muted" onClick={onLogout}>
                <LogOut style={{ width: 12, height: 12 }} strokeWidth={1.7} />
                Sign out
              </button>
            </div>
            <label className="toggle-row">
              <span>
                <span style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 500 }}>Cloud sync</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block' }}>
                  Sync history, templates & settings across devices
                </span>
              </span>
              <input
                type="checkbox"
                checked={cloudSettings.cloud_sync_enabled}
                onChange={(e) => onCloudPatch({ cloud_sync_enabled: e.target.checked })}
                className="toggle-input"
              />
            </label>
          </>
        ) : (
          <>
            <p className="card-description" style={{ marginBottom: 10 }}>
              Sign in with your PromptEnhancer account to sync everything across devices.
            </p>
            <button className="btn-primary" onClick={onOpenLogin}>
              <UserIcon style={{ width: 14, height: 14 }} strokeWidth={2} />
              Sign in
            </button>
            <a href={`${FRONTEND_URL}/request-access`} target="_blank" rel="noopener noreferrer" className="auth-link" style={{ marginTop: 8, justifyContent: 'center' }}>
              <ExternalLink style={{ width: 11, height: 11 }} strokeWidth={1.7} />
              Don't have an account? Request access
            </a>
          </>
        )}
      </div>

      {/* AI Provider & API Key */}
      <div className="card">
        <div className="card-label" style={{ marginBottom: 4 }}>
          <Bot style={{ width: 13, height: 13, color: '#A78BFA' }} strokeWidth={1.7} />
          AI Provider
        </div>
        <p className="card-description" style={{ marginBottom: 10 }}>
          Use your own free API key — no subscription, no limits.
        </p>

        <div className="seg-group">
          {(['groq', 'gemini'] as Provider[]).map((p) => (
            <button
              key={p}
              className={`seg-btn ${cloudSettings.preferred_provider === p ? 'seg-btn-active' : ''}`}
              onClick={() => switchProvider(p)}
            >
              {p === 'groq' ? '⚡ Groq' : '✦ Gemini'}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="card-description" style={{ marginBottom: 4, fontSize: 10 }}>Model</div>
          <select
            className="input"
            value={cloudSettings.preferred_model}
            onChange={(e) => onCloudPatch({ preferred_model: e.target.value })}
          >
            <option value="">Default (Recommended)</option>
            {MODELS_FOR[cloudSettings.preferred_provider].map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="card-description" style={{ marginBottom: 4, fontSize: 10 }}>
            API Key {cloudSettings.preferred_provider === 'groq' ? '(starts with gsk_…)' : '(starts with AIza…)'}
          </div>
          <div className="input-with-action">
            <input
              type={showKey ? 'text' : 'password'}
              className="input"
              placeholder={cloudSettings.preferred_provider === 'groq' ? 'gsk_…' : 'AIza…'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              style={{ fontFamily: 'monospace', paddingRight: 36 }}
            />
            <button className="input-eye" onClick={() => setShowKey((v) => !v)} type="button">
              {showKey ? <EyeOff style={{ width: 14, height: 14 }} strokeWidth={1.5} /> : <Eye style={{ width: 14, height: 14 }} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            className="btn-ghost"
            onClick={verify}
            disabled={verifyStatus === 'loading' || !keyInput.trim()}
            style={{
              flex: 1,
              color: verifyStatus === 'ok' ? '#10B981' : verifyStatus === 'error' ? '#EF4444' : undefined,
              borderColor: verifyStatus === 'ok' ? 'rgba(16,185,129,0.4)' : verifyStatus === 'error' ? 'rgba(239,68,68,0.4)' : undefined,
            }}
          >
            {verifyStatus === 'loading' && '⏳ Verifying…'}
            {verifyStatus === 'ok' && <><Check style={{ width: 12, height: 12 }} strokeWidth={2} /> {verifyMsg || 'Valid'}</>}
            {verifyStatus === 'error' && <><X style={{ width: 12, height: 12 }} strokeWidth={2} /> {verifyMsg || 'Invalid'}</>}
            {verifyStatus === 'idle' && 'Verify'}
          </button>
          <button className="btn-primary" onClick={saveKey} style={{ flex: 1 }}>
            {savedFlash === 'apikey' ? '✓ Saved' : 'Save key'}
          </button>
        </div>

        <div className="key-links">
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
            <ExternalLink style={{ width: 10, height: 10 }} strokeWidth={1.5} />
            Get free Groq key (14,400 req/day)
          </a>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            <ExternalLink style={{ width: 10, height: 10 }} strokeWidth={1.5} />
            Get free Gemini key
          </a>
        </div>
      </div>

      {/* Appearance */}
      <div className="card">
        <div className="card-label" style={{ marginBottom: 8 }}>
          <Palette style={{ width: 13, height: 13, color: '#A78BFA' }} strokeWidth={1.7} />
          Appearance
        </div>
        <div className="setting-stack">
          <div>
            <div className="setting-row-label">Theme</div>
            <div className="seg-group">
              {themeBtn('dark', 'Dark', <Moon style={{ width: 11, height: 11 }} strokeWidth={1.7} />)}
              {themeBtn('light', 'Light', <Sun style={{ width: 11, height: 11 }} strokeWidth={1.7} />)}
              {themeBtn('auto', 'Auto', <Monitor style={{ width: 11, height: 11 }} strokeWidth={1.7} />)}
            </div>
          </div>
          <div>
            <div className="setting-row-label">Density</div>
            <div className="seg-group">
              {densityBtn('comfortable', 'Comfortable')}
              {densityBtn('compact', 'Compact')}
            </div>
          </div>
        </div>
      </div>

      {/* Backend URL */}
      <div className="card">
        <div className="card-label" style={{ marginBottom: 4 }}>
          <Server style={{ width: 13, height: 13, color: '#A78BFA' }} strokeWidth={1.7} />
          Backend Server URL
        </div>
        <p className="card-description" style={{ marginBottom: 8 }}>
          Point to your deployed PromptEnhancer backend.
        </p>
        <input
          type="text"
          className="input"
          placeholder="https://promptenhancer-backend.onrender.com"
          value={backendUrlInput}
          onChange={(e) => setBackendUrlInput(e.target.value)}
          spellCheck={false}
        />
        <button
          onClick={saveBackendUrl}
          disabled={!backendUrlInput.trim() || backendUrlInput.trim() === localSettings.backendUrl}
          className="btn-primary"
          style={{ marginTop: 8 }}
        >
          {savedFlash === 'backend' ? '✓ Saved' : 'Save URL'}
        </button>
        <p style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-3)' }}>
          Current: <span style={{ color: 'var(--text-2)' }}>{localSettings.backendUrl}</span>
        </p>
      </div>

      {/* About */}
      <div className="card about-card">
        <div className="setting-label">About</div>
        <div className="setting-desc" style={{ marginTop: 4 }}>
          PromptEnhancer Pro v2.0 · BYOK · Groq + Gemini
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <AlertCircle style={{ width: 11, height: 11, color: '#A78BFA' }} strokeWidth={1.7} />
          Need access?
          <a href={`${FRONTEND_URL}/request-access`} target="_blank" rel="noopener noreferrer" style={{ color: '#A78BFA' }}>
            Request it here →
          </a>
        </div>
      </div>
    </motion.div>
  );
}
