import { Check, Sparkles, AlertCircle, ExternalLink, TrendingUp, Zap, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import type { CloudSettings, HistoryItem, User, Tab } from '../lib/types';
import { FRONTEND_URL, MODES } from '../lib/constants';

interface Props {
  user: User | null;
  cloudSettings: CloudSettings;
  history: HistoryItem[];
  setActiveTab: (t: Tab) => void;
}

export function HomeTab({ user, cloudSettings, history, setActiveTab }: Props) {
  const activeKey = cloudSettings.preferred_provider === 'groq'
    ? cloudSettings.groq_api_key
    : cloudSettings.gemini_api_key;
  const hasApiKey = activeKey.length > 0;

  // last 14 days bar data
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (13 - i));
    return d;
  });
  const counts = days.map((d) => {
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    return history.filter((h) => h.timestamp >= d.getTime() && h.timestamp < next.getTime()).length;
  });
  const max = Math.max(1, ...counts);

  const today = new Date().toDateString();
  const todayCount = history.filter((h) => new Date(h.timestamp).toDateString() === today).length;
  const weekCount = history.filter((h) => Date.now() - h.timestamp < 7 * 86400000).length;

  return (
    <motion.div key="home" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
      {/* User card (if logged in) */}
      {user && (
        <div className="user-card">
          <div className="user-card-avatar">{user.initials}</div>
          <div className="user-card-meta">
            <div className="user-card-name">{user.name}</div>
            <div className="user-card-email">{user.email}</div>
          </div>
          <a
            href={`${FRONTEND_URL}${user.is_staff ? '/dashboard' : '/'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="user-card-dash"
            title="Open web dashboard"
          >
            <ExternalLink style={{ width: 12, height: 12 }} strokeWidth={1.7} />
            Dashboard
          </a>
        </div>
      )}

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{history.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{todayCount}</span>
          <span className="stat-label">Today</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{weekCount}</span>
          <span className="stat-label">Week</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value" style={{ color: hasApiKey ? '#10B981' : '#EF4444', fontSize: 11 }}>
            {hasApiKey ? cloudSettings.preferred_provider.toUpperCase() : 'NO KEY'}
          </span>
          <span className="stat-label">Provider</span>
        </div>
      </div>

      {/* Daily usage chart */}
      <div className="card">
        <div className="card-label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp style={{ width: 13, height: 13, color: '#A78BFA' }} strokeWidth={1.7} />
          Last 14 days
        </div>
        <div className="usage-chart">
          {counts.map((c, i) => (
            <div key={i} className="usage-bar-wrap" title={`${days[i].toLocaleDateString()}: ${c}`}>
              <div
                className="usage-bar"
                style={{ height: `${Math.max(4, (c / max) * 100)}%`, opacity: c === 0 ? 0.18 : 1 }}
              />
            </div>
          ))}
        </div>
        <div className="usage-legend">
          <span>{days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          <span style={{ color: '#71717A' }}>{history.length} all-time</span>
          <span>{days[days.length - 1].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Status (no key warn / ready) */}
      {!hasApiKey && (
        <div className="warn-card">
          <AlertCircle style={{ width: 16, height: 16, color: '#F59E0B', flexShrink: 0, marginTop: 1 }} strokeWidth={1.5} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>API Key Required</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Go to <button className="inline-link" onClick={() => setActiveTab('settings')}><strong>Settings</strong></button> and add your free Groq or Gemini API key to start enhancing.
            </div>
          </div>
        </div>
      )}
      {hasApiKey && (
        <div className="ready-card">
          <div className="ready-icon">
            <Check style={{ width: 16, height: 16, color: '#10B981' }} strokeWidth={2.5} />
          </div>
          <div>
            <div className="ready-title">Ready to Enhance</div>
            <div className="ready-sub">
              {cloudSettings.preferred_provider === 'groq' ? '⚡ Groq' : '✦ Gemini'}
              {' · '}
              {cloudSettings.preferred_model || (cloudSettings.preferred_provider === 'groq' ? 'Llama 3.3 70B' : 'Gemini 2.0 Flash')}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="quick-actions">
        <button className="quick-action" onClick={() => setActiveTab('enhance')}>
          <Zap style={{ width: 14, height: 14, color: '#F59E0B' }} strokeWidth={1.7} />
          <span>Quick Enhance</span>
        </button>
        <button className="quick-action" onClick={() => setActiveTab('templates')}>
          <BookOpen style={{ width: 14, height: 14, color: '#3B82F6' }} strokeWidth={1.7} />
          <span>Templates</span>
        </button>
      </div>

      {/* Recent enhancements preview */}
      {history.length > 0 && (
        <div className="card">
          <div className="card-label" style={{ marginBottom: 8 }}>Recent</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {history.slice(0, 3).map((h) => (
              <button key={h.id} className="recent-row" onClick={() => setActiveTab('history')}>
                <span className="recent-type" style={{ color: MODES.find(m => m.mode === h.type)?.color || '#A78BFA' }}>{h.type}</span>
                <span className="recent-snippet">{h.original.slice(0, 50)}{h.original.length > 50 ? '…' : ''}</span>
              </button>
            ))}
          </div>
          <button className="recent-viewall" onClick={() => setActiveTab('history')}>
            View all history →
          </button>
        </div>
      )}

      {/* How to use */}
      <div className="card">
        <div className="how-title">How to Use</div>
        <div className="how-step"><span className="how-num">1</span><span>Go to any AI chat (Claude, ChatGPT, Gemini…)</span></div>
        <div className="how-step"><span className="how-num">2</span><span>Click the <Sparkles style={{ width: 12, height: 12, color: '#8B5CF6', display: 'inline' }} /> button on the text input</span></div>
        <div className="how-step" style={{ marginBottom: 0 }}><span className="how-num">3</span><span>Pick a mode — your prompt is enhanced instantly ✨</span></div>
      </div>
    </motion.div>
  );
}
