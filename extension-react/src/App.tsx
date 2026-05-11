import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Check, Loader2, History, Settings,
  BookTemplate, Trash2, Clock, ChevronRight,
  Wand2, Briefcase, Scissors, Code, Zap, Copy, Search,
  ShieldCheck, AlertCircle, KeyRound, Eye, EyeOff, ExternalLink,
} from 'lucide-react';
import './App.css';
import './index.css';

type Tab = 'home' | 'history' | 'templates' | 'settings';
type Provider = 'groq' | 'gemini';

interface ApiSettings {
  provider: Provider;
  apiKey: string;
  model: string;
}

interface HistoryItem {
  id: string;
  original: string;
  enhanced: string;
  type: string;
  timestamp: number;
  domain?: string;
}

interface Template {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
}

const GROQ_MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Recommended)' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fastest)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
];

const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommended)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Smartest)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
];

const MODE_GUIDE = [
  { icon: <Wand2 style={{ width: 12, height: 12 }} strokeWidth={1.5} />, color: '#8B5CF6', mode: 'Enhance', desc: 'Adds structure, context & detail — 3-5x better AI output' },
  { icon: <Briefcase style={{ width: 12, height: 12 }} strokeWidth={1.5} />, color: '#3B82F6', mode: 'Professional', desc: 'Rewrites in formal, corporate language' },
  { icon: <Scissors style={{ width: 12, height: 12 }} strokeWidth={1.5} />, color: '#10B981', mode: 'Shorten', desc: 'Cuts to the point, preserves all key info' },
  { icon: <Code style={{ width: 12, height: 12 }} strokeWidth={1.5} />, color: '#F59E0B', mode: 'Code', desc: 'Technical precision for programming tasks' },
  { icon: <Zap style={{ width: 12, height: 12 }} strokeWidth={1.5} />, color: '#EC4899', mode: 'Creative', desc: 'Adds imagination, emotion & vivid language' },
];

function App() {
  const [inviteCode, setInviteCode] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [inviteLabel, setInviteLabel] = useState('');
  const [validateStatus, setValidateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [validateMsg, setValidateMsg] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, today: 0 });
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [backendUrlInput, setBackendUrlInput] = useState('');
  const [urlSaved, setUrlSaved] = useState(false);

  // BYOK state
  const [apiSettings, setApiSettings] = useState<ApiSettings>({ provider: 'gemini', apiKey: '', model: '' });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiProvider, setApiProvider] = useState<Provider>('gemini');
  const [apiModel, setApiModel] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['inviteCode', 'inviteLabel', 'settings', 'apiSettings'], (result: any) => {
        if (result.inviteCode) {
          setInviteCode(result.inviteCode);
          setInviteLabel(result.inviteLabel || '');
        }
        if (result.settings?.backendUrl) {
          setBackendUrl(result.settings.backendUrl);
          setBackendUrlInput(result.settings.backendUrl);
        }
        if (result.apiSettings) {
          const saved = result.apiSettings as ApiSettings;
          setApiSettings(saved);
          setApiProvider(saved.provider || 'gemini');
          setApiKeyInput(saved.apiKey || '');
          setApiModel(saved.model || '');
        }
      });
    }
    loadHistory();
    loadTemplates();
  }, []);

  const loadHistory = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'getHistory' }, (response: any) => {
        if (response?.history) {
          setHistory(response.history);
          const today = new Date().toDateString();
          const todayCount = response.history.filter(
            (h: HistoryItem) => new Date(h.timestamp).toDateString() === today,
          ).length;
          setStats({ total: response.history.length, today: todayCount });
        }
      });
    }
  };

  const loadTemplates = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'getTemplates' }, (response: any) => {
        if (response?.templates) setTemplates(response.templates);
      });
    }
  };

  const validateInvite = () => {
    if (!inviteInput.trim()) return;
    setValidateStatus('loading');
    setValidateMsg('');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'validateInvite', code: inviteInput.trim() }, (response: any) => {
        if (response?.valid) {
          const label = response.label || '';
          chrome.storage.local.set({ inviteCode: inviteInput.trim(), inviteLabel: label }, () => {
            setInviteCode(inviteInput.trim());
            setInviteLabel(label);
            setValidateStatus('success');
            setValidateMsg(label ? `Welcome, ${label}!` : 'Access granted!');
          });
        } else {
          setValidateStatus('error');
          setValidateMsg(response?.message || 'Invalid code. Try again.');
          setTimeout(() => setValidateStatus('idle'), 3000);
        }
      });
    }
  };

  const saveApiSettings = () => {
    const newSettings: ApiSettings = { provider: apiProvider, apiKey: apiKeyInput.trim(), model: apiModel };
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ apiSettings: newSettings }, () => {
        setApiSettings(newSettings);
        setApiKeySaved(true);
        setTimeout(() => setApiKeySaved(false), 2000);
      });
    }
  };

  const clearHistory = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'clearHistory' }, () => {
        setHistory([]);
        setStats({ total: 0, today: 0 });
      });
    }
  };

  const saveBackendUrl = () => {
    const url = backendUrlInput.trim().replace(/\/$/, '');
    if (!url) return;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['settings'], (result: any) => {
        const settings = result.settings || {};
        chrome.storage.local.set({ settings: { ...settings, backendUrl: url } }, () => {
          setBackendUrl(url);
          setUrlSaved(true);
          setTimeout(() => setUrlSaved(false), 2000);
        });
      });
    }
  };

  const revokeAccess = () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['inviteCode', 'inviteLabel'], () => {
        setInviteCode('');
        setInviteLabel('');
        setInviteInput('');
        setValidateStatus('idle');
        setValidateMsg('');
      });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getTypeIcon = (type: string) => {
    const s = { style: { width: 12, height: 12 }, strokeWidth: 2 as const };
    switch (type) {
      case 'Enhance': return <Wand2 {...s} style={{ ...s.style, color: '#8B5CF6' }} />;
      case 'Professional': return <Briefcase {...s} style={{ ...s.style, color: '#3B82F6' }} />;
      case 'Shorten': return <Scissors {...s} style={{ ...s.style, color: '#10B981' }} />;
      case 'Code': return <Code {...s} style={{ ...s.style, color: '#F59E0B' }} />;
      case 'Creative': return <Zap {...s} style={{ ...s.style, color: '#EC4899' }} />;
      default: return <Sparkles {...s} style={{ ...s.style, color: '#8B5CF6' }} />;
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.shortcut.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const hasApiKey = apiSettings.apiKey.length > 0;

  // ---- Gate: invite code screen ----
  if (!inviteCode) {
    return (
      <div className="popup-container">
        <div className="glow glow-top" />
        <header className="header">
          <div className="header-brand">
            <div className="header-icon-wrap">
              <Sparkles className="header-icon" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="header-title">PromptEnhancer Pro</h1>
              <p className="header-subtitle">Invite-only · v2.0</p>
            </div>
          </div>
        </header>

        <main className="main-content" style={{ paddingTop: 16 }}>
          <div className="card" style={{ textAlign: 'center', padding: '24px 20px' }}>
            <KeyRound style={{ width: 40, height: 40, color: '#8B5CF6', margin: '0 auto 12px' }} strokeWidth={1.5} />
            <div className="card-label" style={{ fontSize: 15, marginBottom: 6 }}>Enter Your Invite Code</div>
            <p className="card-description" style={{ marginBottom: 16 }}>
              PromptEnhancer Pro is invite-only. Enter the code from your approval email.
            </p>
            <div className="input-group">
              <input
                type="text"
                className="input"
                placeholder="XXXX-XXXX-XXXX"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                onKeyDown={(e) => e.key === 'Enter' && validateInvite()}
                style={{ textAlign: 'center', letterSpacing: '0.05em', textTransform: 'uppercase' }}
              />
            </div>
            {validateMsg && (
              <p style={{ marginTop: 8, fontSize: 12, color: validateStatus === 'error' ? '#EF4444' : '#10B981' }}>
                {validateMsg}
              </p>
            )}
            <button
              onClick={validateInvite}
              disabled={validateStatus === 'loading' || !inviteInput.trim()}
              className="btn-primary"
              style={{ marginTop: 12 }}
            >
              <AnimatePresence mode="wait">
                {validateStatus === 'idle' && <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Validate Code</motion.span>}
                {validateStatus === 'loading' && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} strokeWidth={2} /></motion.div>}
                {(validateStatus === 'success' || validateStatus === 'error') && <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{validateStatus === 'success' ? '✓ Access Granted' : '✗ Try Again'}</motion.span>}
              </AnimatePresence>
            </button>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#52525B', lineHeight: 1.6 }}>
              <strong style={{ color: '#A1A1AA' }}>Need access?</strong>{' '}
              Visit the web app to request an invite. Codes are personal and non-transferable.
            </div>
          </div>
        </main>

        <footer className="footer"><div className="status-dot" />Invite code required</footer>
      </div>
    );
  }

  // ---- Main UI ----
  return (
    <div className="popup-container">
      <div className="glow glow-top" />
      <div className="glow glow-bottom" />

      <header className="header">
        <div className="header-brand">
          <div className="header-icon-wrap">
            <Sparkles className="header-icon" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="header-title">PromptEnhancer Pro</h1>
            <p className="header-subtitle">{inviteLabel ? `${inviteLabel} · v2.0` : 'Active · v2.0'}</p>
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        {[
          { id: 'home' as Tab, icon: <ShieldCheck style={{ width: 14, height: 14 }} strokeWidth={1.5} />, label: 'Home' },
          { id: 'history' as Tab, icon: <History style={{ width: 14, height: 14 }} strokeWidth={1.5} />, label: 'History' },
          { id: 'templates' as Tab, icon: <BookTemplate style={{ width: 14, height: 14 }} strokeWidth={1.5} />, label: 'Templates' },
          { id: 'settings' as Tab, icon: <Settings style={{ width: 14, height: 14 }} strokeWidth={1.5} />, label: 'Settings' },
        ].map((tab) => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'tab-active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="main-content">
        <AnimatePresence mode="wait">

          {/* ============ HOME TAB ============ */}
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
              <div className="stats-bar">
                <div className="stat-item"><span className="stat-value">{stats.total}</span><span className="stat-label">Total</span></div>
                <div className="stat-divider" />
                <div className="stat-item"><span className="stat-value">{stats.today}</span><span className="stat-label">Today</span></div>
                <div className="stat-divider" />
                <div className="stat-item">
                  <span className="stat-value" style={{ color: hasApiKey ? '#10B981' : '#EF4444', fontSize: 11 }}>
                    {hasApiKey ? apiSettings.provider.toUpperCase() : 'NO KEY'}
                  </span>
                  <span className="stat-label">Provider</span>
                </div>
              </div>

              {!hasApiKey && (
                <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, padding: '12px 14px' }}>
                  <AlertCircle style={{ width: 16, height: 16, color: '#F59E0B', flexShrink: 0, marginTop: 1 }} strokeWidth={1.5} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#FAFAFA', marginBottom: 2 }}>API Key Required</div>
                    <div style={{ fontSize: 11, color: '#71717A' }}>
                      Go to <strong style={{ color: '#A78BFA' }}>Settings</strong> tab and add your free Groq or Gemini API key to start enhancing.
                    </div>
                  </div>
                </div>
              )}

              {hasApiKey && (
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check style={{ width: 16, height: 16, color: '#10B981' }} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#FAFAFA' }}>Ready to Enhance</div>
                    <div style={{ fontSize: 11, color: '#52525B', marginTop: 2 }}>
                      {apiSettings.provider === 'groq' ? '⚡ Groq' : '✦ Gemini'} · {apiSettings.model || (apiSettings.provider === 'groq' ? 'Llama 3.3 70B' : 'Gemini 2.0 Flash')}
                    </div>
                  </div>
                </div>
              )}

              <div className="card guide-card" style={{ marginTop: 8 }}>
                <div className="guide-title">How to Use</div>
                <div className="guide-steps">
                  <div className="guide-step"><span className="guide-step-num">1</span><span>Go to any AI chat (Claude, ChatGPT, Gemini…)</span></div>
                  <div className="guide-step"><span className="guide-step-num">2</span><span>Click the <Sparkles style={{ width: 12, height: 12, color: '#8B5CF6', display: 'inline' }} /> button on the text input</span></div>
                  <div className="guide-step"><span className="guide-step-num">3</span><span>Pick a mode — your prompt is enhanced instantly ✨</span></div>
                </div>
              </div>

              <div className="card" style={{ marginTop: 8 }}>
                <div className="guide-title" style={{ marginBottom: 8 }}>Enhancement Modes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {MODE_GUIDE.map((m) => (
                    <div key={m.mode} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: m.color, flexShrink: 0, marginTop: 2 }}>{m.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#FAFAFA' }}>{m.mode}</div>
                        <div style={{ fontSize: 11, color: '#71717A', lineHeight: 1.4 }}>{m.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ============ HISTORY TAB ============ */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
              {history.length === 0 ? (
                <div className="empty-state">
                  <Clock style={{ width: 32, height: 32, color: '#3F3F46' }} strokeWidth={1} />
                  <p>No history yet</p>
                  <span>Enhanced prompts appear here</span>
                </div>
              ) : (
                <>
                  <div className="history-header">
                    <span className="history-count">{history.length} enhancements</span>
                    <button className="text-btn danger" onClick={clearHistory}><Trash2 style={{ width: 12, height: 12 }} /> Clear All</button>
                  </div>
                  <div className="history-list">
                    {history.slice(0, 20).map((item) => (
                      <div key={item.id} className="history-item">
                        <div className="history-item-header">
                          <div className="history-item-meta">
                            {getTypeIcon(item.type)}
                            <span className="history-type">{item.type}</span>
                            <span className="history-time">{formatTime(item.timestamp)}</span>
                          </div>
                          <button className="icon-btn" onClick={() => copyToClipboard(item.enhanced, item.id)}>
                            {copiedId === item.id
                              ? <Check style={{ width: 12, height: 12, color: '#10B981' }} strokeWidth={2} />
                              : <Copy style={{ width: 12, height: 12 }} strokeWidth={1.5} />}
                          </button>
                        </div>
                        <div className="history-original">{item.original.substring(0, 80)}{item.original.length > 80 ? '…' : ''}</div>
                        <div className="history-enhanced">
                          <ChevronRight style={{ width: 10, height: 10, color: '#8B5CF6', flexShrink: 0 }} />
                          {item.enhanced.substring(0, 120)}{item.enhanced.length > 120 ? '…' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ============ TEMPLATES TAB ============ */}
          {activeTab === 'templates' && (
            <motion.div key="templates" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
              <div className="search-bar">
                <Search style={{ width: 14, height: 14, color: '#52525B' }} strokeWidth={1.5} />
                <input type="text" className="search-input" placeholder="Search templates…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div style={{ marginBottom: 8, fontSize: 11, color: '#52525B', paddingLeft: 2 }}>
                Type a shortcut (e.g. <code style={{ background: '#27272A', padding: '1px 4px', borderRadius: 3, color: '#A78BFA' }}>//code</code>) in any AI chat to auto-insert.
              </div>
              <div className="template-list">
                {filteredTemplates.map((t) => (
                  <div key={t.id} className="template-item">
                    <div className="template-header">
                      <span className="template-shortcut">{t.shortcut}</span>
                      <span className="template-category">{t.category}</span>
                    </div>
                    <div className="template-title">{t.title}</div>
                    <div className="template-content">{t.content.substring(0, 90)}…</div>
                    <button className="template-copy-btn" onClick={() => copyToClipboard(t.content, t.id)}>
                      {copiedId === t.id
                        ? <><Check style={{ width: 12, height: 12, color: '#10B981' }} strokeWidth={2} /> Copied!</>
                        : <><Copy style={{ width: 12, height: 12 }} strokeWidth={1.5} /> Copy</>}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ============ SETTINGS TAB ============ */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>

              {/* ---- BYOK Section ---- */}
              <div className="card">
                <label className="card-label">AI Provider & API Key</label>
                <p className="card-description" style={{ marginBottom: 10 }}>
                  Use your own free API key — no subscription, no limits.
                </p>

                {/* Provider toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {(['groq', 'gemini'] as Provider[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setApiProvider(p); setApiModel(''); }}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 8,
                        border: apiProvider === p ? '1px solid #7C3AED' : '1px solid rgba(255,255,255,0.08)',
                        background: apiProvider === p ? 'rgba(124,58,237,0.15)' : 'transparent',
                        color: apiProvider === p ? '#A78BFA' : '#71717A',
                        fontSize: 12, fontWeight: apiProvider === p ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {p === 'groq' ? '⚡ Groq' : '✦ Gemini'}
                    </button>
                  ))}
                </div>

                {/* Model selector */}
                <div style={{ marginBottom: 10 }}>
                  <div className="card-description" style={{ marginBottom: 4, fontSize: 10 }}>Model</div>
                  <select
                    value={apiModel}
                    onChange={(e) => setApiModel(e.target.value)}
                    style={{
                      width: '100%', padding: '7px 10px', background: '#09090B',
                      border: '1px solid #27272A', borderRadius: 8, color: '#FAFAFA',
                      fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="">Default (Recommended)</option>
                    {(apiProvider === 'groq' ? GROQ_MODELS : GEMINI_MODELS).map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* API Key input */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <div className="card-description" style={{ marginBottom: 4, fontSize: 10 }}>
                    API Key {apiProvider === 'groq' ? '(starts with gsk_…)' : '(starts with AIza…)'}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      className="input"
                      placeholder={apiProvider === 'groq' ? 'gsk_…' : 'AIza…'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      spellCheck={false}
                      autoComplete="off"
                      style={{ paddingRight: 36, fontSize: 12, fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', cursor: 'pointer', color: '#52525B', padding: 4,
                      }}
                    >
                      {showApiKey
                        ? <EyeOff style={{ width: 14, height: 14 }} strokeWidth={1.5} />
                        : <Eye style={{ width: 14, height: 14 }} strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                {/* Get API key links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: '#8B5CF6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <ExternalLink style={{ width: 10, height: 10 }} strokeWidth={1.5} />
                    Get free Groq API key (14,400 req/day) →
                  </a>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: '#8B5CF6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <ExternalLink style={{ width: 10, height: 10 }} strokeWidth={1.5} />
                    Get free Gemini API key →
                  </a>
                </div>

                <button onClick={saveApiSettings} className="btn-primary" style={{ marginTop: 4 }}>
                  {apiKeySaved ? '✓ Saved' : 'Save API Settings'}
                </button>

                {apiSettings.apiKey && (
                  <p style={{ marginTop: 6, fontSize: 11, color: '#10B981' }}>
                    ✓ API key configured · {apiSettings.provider}
                  </p>
                )}
              </div>

              {/* ---- Backend URL ---- */}
              <div className="card">
                <label className="card-label">Backend Server URL</label>
                <p className="card-description" style={{ marginBottom: 8 }}>
                  Point to your deployed PromptEnhancer backend.
                </p>
                <div className="input-group">
                  <input type="text" className="input" placeholder="https://your-app.railway.app" value={backendUrlInput} onChange={(e) => setBackendUrlInput(e.target.value)} spellCheck={false} />
                </div>
                <button onClick={saveBackendUrl} disabled={!backendUrlInput.trim() || backendUrlInput.trim() === backendUrl} className="btn-primary" style={{ marginTop: 8 }}>
                  {urlSaved ? '✓ Saved' : 'Save URL'}
                </button>
                <p style={{ marginTop: 6, fontSize: 11, color: '#52525B' }}>
                  Current: <span style={{ color: '#A1A1AA' }}>{backendUrl}</span>
                </p>
              </div>

              {/* ---- Invite Code Info ---- */}
              <div className="card">
                <div className="setting-item">
                  <div>
                    <div className="setting-label">Access Code</div>
                    <div className="setting-desc" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                      {inviteCode.substring(0, 6)}{'•'.repeat(Math.max(0, inviteCode.length - 6))}
                    </div>
                  </div>
                  <button onClick={revokeAccess} style={{ fontSize: 11, color: '#EF4444', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                    Revoke
                  </button>
                </div>
                <div className="setting-divider" />
                <div className="setting-item">
                  <div>
                    <div className="setting-label">Supported Sites</div>
                    <div className="setting-desc">ChatGPT, Claude, Gemini + any site</div>
                  </div>
                  <div className="setting-badge active">7+</div>
                </div>
              </div>

              <div className="card about-card">
                <div className="setting-label">About</div>
                <div className="setting-desc" style={{ marginTop: 4 }}>
                  PromptEnhancer Pro v2.0 · BYOK · Invite-only · Groq + Gemini
                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <footer className="footer">
        <div className={`status-dot ${hasApiKey ? 'active' : ''}`} />
        {hasApiKey ? `${apiSettings.provider === 'groq' ? '⚡ Groq' : '✦ Gemini'} ready` : 'API key required — see Settings'}
      </footer>
    </div>
  );
}

export default App;
