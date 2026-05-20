import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, History as HistoryIcon, BookTemplate, Settings as SettingsIcon, Zap,
} from 'lucide-react';
import './App.css';
import './index.css';
import { Header } from './components/Header';
import { LoginScreen, ApprovalPending } from './screens/LoginScreen';
import { HomeTab } from './screens/HomeTab';
import { EnhanceTab } from './screens/EnhanceTab';
import { HistoryTab } from './screens/HistoryTab';
import { TemplatesTab } from './screens/TemplatesTab';
import { SettingsTab } from './screens/SettingsTab';
import type {
  AuthState, CloudSettings, HistoryItem, LocalSettings, Tab, Template,
} from './lib/types';
import {
  DEFAULT_CLOUD_SETTINGS, DEFAULT_LOCAL_SETTINGS, applyAppearance,
  clearAuth, getAuth, getCloudSettingsLocal, getLocalHistory, getLocalSettings,
  getLocalTemplates, saveCloudSettingsLocal, saveLocalSettings,
  setLocalHistory, setLocalTemplates, setPendingEmail,
} from './lib/storage';
import {
  createTemplate, deleteHistory, deleteTemplate, fetchHistory, fetchMe,
  fetchTemplates, logoutExtension, patchSettings, postHistory, updateTemplate,
} from './lib/api';

type Mode = 'app' | 'login' | 'pending';

function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading', token: '', user: null, pendingEmail: '' });
  const [mode, setMode] = useState<Mode>('app');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [cloudSettings, setCloudSettings] = useState<CloudSettings>(DEFAULT_CLOUD_SETTINGS);
  const [localSettings, setLocalSettingsState] = useState<LocalSettings>(DEFAULT_LOCAL_SETTINGS);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Initial load
  useEffect(() => {
    (async () => {
      const [a, cs, ls, h, t] = await Promise.all([
        getAuth(),
        getCloudSettingsLocal(),
        getLocalSettings(),
        getLocalHistory(),
        getLocalTemplates(),
      ]);
      setAuth(a);
      setCloudSettings(cs);
      setLocalSettingsState(ls);
      setHistory(h);
      setTemplates(t);
      applyAppearance(cs.theme, cs.density);

      if (a.status === 'pending') setMode('pending');
      else if (a.status === 'unauthenticated') setMode('app'); // allow local mode
      else setMode('app');

      // Pull remote state if logged in
      if (a.status === 'authenticated' && a.token) {
        try {
          const me = await fetchMe(a.token);
          setCloudSettings(me.settings);
          await saveCloudSettingsLocal(me.settings);
          applyAppearance(me.settings.theme, me.settings.density);
          await pullRemoteData(a.token);
        } catch (err: unknown) {
          const e = err as { status?: number };
          if (e.status === 401) {
            await clearAuth();
            setAuth({ status: 'unauthenticated', token: '', user: null, pendingEmail: '' });
          }
        }
      }
    })();
  }, []);

  const pullRemoteData = async (token: string) => {
    try {
      const [h, tpl] = await Promise.all([
        fetchHistory(token, 100),
        fetchTemplates(token),
      ]);
      const remoteHistory: HistoryItem[] = h.entries.map((e) => ({
        id: `r${e.id}`,
        remoteId: e.id,
        original: e.original_text,
        enhanced: e.enhanced_text,
        type: e.action,
        timestamp: new Date(e.created_at).getTime(),
        domain: e.domain,
        provider: e.provider,
        model: e.model_used,
      }));
      setHistory(remoteHistory);
      await setLocalHistory(remoteHistory);

      const remoteTpl: Template[] = tpl.templates.map((t) => ({
        id: `r${t.id}`,
        remoteId: t.id,
        shortcut: t.shortcut,
        title: t.title,
        content: t.content,
        category: t.category,
        isDefault: t.is_default,
      }));
      setTemplates(remoteTpl);
      await setLocalTemplates(remoteTpl);
    } catch { /* keep local */ }
  };

  // Listen for new history events from background (in-page enhance)
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local') return;
      if (changes.promptHistory) {
        setHistory((changes.promptHistory.newValue as HistoryItem[]) || []);
      }
      if (changes.cloudSettings) {
        const cs = changes.cloudSettings.newValue as CloudSettings | undefined;
        if (cs) {
          setCloudSettings(cs);
          applyAppearance(cs.theme, cs.density);
        }
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleAuthenticated = useCallback((next: AuthState) => {
    setAuth(next);
    if (next.status === 'pending') setMode('pending');
    else setMode('app');
    if (next.status === 'authenticated' && next.token) {
      pullRemoteData(next.token);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    if (auth.token) logoutExtension(auth.token);
    await clearAuth();
    setAuth({ status: 'unauthenticated', token: '', user: null, pendingEmail: '' });
    setMode('app');
    setActiveTab('home');
  }, [auth.token]);

  const onCloudPatch = useCallback(async (patch: Partial<CloudSettings>) => {
    const next = { ...cloudSettings, ...patch };
    setCloudSettings(next);
    await saveCloudSettingsLocal(next);
    applyAppearance(next.theme, next.density);
    if (auth.token) {
      try {
        const r = await patchSettings(auth.token, patch);
        setCloudSettings(r.settings);
        await saveCloudSettingsLocal(r.settings);
      } catch { /* keep local */ }
    }
  }, [cloudSettings, auth.token]);

  const onLocalPatch = useCallback(async (patch: Partial<LocalSettings>) => {
    const next = await saveLocalSettings(patch);
    setLocalSettingsState(next);
  }, []);

  const onVerifyKey = useCallback(async (provider: 'groq' | 'gemini', apiKey: string) => {
    return new Promise<{ valid: boolean; error?: string }>((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        resolve({ valid: false, error: 'Chrome runtime unavailable' });
        return;
      }
      chrome.runtime.sendMessage(
        { action: 'verifyApiKey', apiKey, provider },
        (resp: { valid?: boolean; error?: string }) => resolve({ valid: !!resp?.valid, error: resp?.error })
      );
    });
  }, []);

  const onAddHistory = useCallback(async (entry: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const local: HistoryItem = {
      ...entry,
      id: `l${Date.now()}`,
      timestamp: Date.now(),
    };
    const next = [local, ...history].slice(0, 200);
    setHistory(next);
    await setLocalHistory(next);
    if (auth.token && cloudSettings.cloud_sync_enabled) {
      try {
        const r = await postHistory(auth.token, {
          action: entry.type,
          provider: entry.provider || cloudSettings.preferred_provider,
          model: entry.model || '',
          original: entry.original,
          enhanced: entry.enhanced,
          domain: entry.domain || '',
        });
        local.remoteId = r.entry.id;
        local.id = `r${r.entry.id}`;
        const updated = [local, ...next.slice(1)];
        setHistory(updated);
        await setLocalHistory(updated);
      } catch { /* local-only */ }
    }
  }, [history, auth.token, cloudSettings]);

  const onDeleteHistory = useCallback(async (id: string, remoteId?: number) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    await setLocalHistory(next);
    if (auth.token && remoteId) {
      try { await deleteHistory(auth.token, remoteId); } catch { /* swallow */ }
    }
  }, [history, auth.token]);

  const onClearHistory = useCallback(async () => {
    setHistory([]);
    await setLocalHistory([]);
    if (auth.token) {
      try { await deleteHistory(auth.token); } catch { /* swallow */ }
    }
  }, [auth.token]);

  const onCreateTemplate = useCallback(async (t: Omit<Template, 'id'>) => {
    if (auth.token) {
      const r = await createTemplate(auth.token, t);
      const created: Template = {
        id: `r${r.template.id}`, remoteId: r.template.id,
        shortcut: r.template.shortcut, title: r.template.title,
        content: r.template.content, category: r.template.category,
        isDefault: r.template.is_default,
      };
      const next = [...templates, created];
      setTemplates(next);
      await setLocalTemplates(next);
    } else {
      const created: Template = { ...t, id: `l${Date.now()}` };
      const next = [...templates, created];
      setTemplates(next);
      await setLocalTemplates(next);
    }
  }, [templates, auth.token]);

  const onUpdateTemplate = useCallback(async (id: string, patch: Partial<Template>) => {
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    if (auth.token && target.remoteId) {
      const r = await updateTemplate(auth.token, {
        id: target.remoteId,
        shortcut: patch.shortcut,
        title: patch.title,
        content: patch.content,
        category: patch.category,
      });
      const next = templates.map((t) => (t.id === id ? {
        ...t,
        shortcut: r.template.shortcut, title: r.template.title,
        content: r.template.content, category: r.template.category,
        isDefault: r.template.is_default,
      } : t));
      setTemplates(next);
      await setLocalTemplates(next);
    } else {
      const next = templates.map((t) => (t.id === id ? { ...t, ...patch } : t));
      setTemplates(next);
      await setLocalTemplates(next);
    }
  }, [templates, auth.token]);

  const onDeleteTemplate = useCallback(async (id: string) => {
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    await setLocalTemplates(next);
    if (auth.token && target.remoteId) {
      try { await deleteTemplate(auth.token, target.remoteId); } catch { /* swallow */ }
    }
  }, [templates, auth.token]);

  const onResyncFromCloud = useCallback(async () => {
    if (!auth.token) return;
    const me = await fetchMe(auth.token);
    setCloudSettings(me.settings);
    await saveCloudSettingsLocal(me.settings);
    applyAppearance(me.settings.theme, me.settings.density);
    await pullRemoteData(auth.token);
  }, [auth.token]);

  // ---- Render ----
  if (auth.status === 'loading') {
    return (
      <div className="popup-container">
        <div className="splash"><div className="splash-spinner" /></div>
      </div>
    );
  }

  if (mode === 'pending') {
    return (
      <div className="popup-container">
        <ApprovalPending
          email={auth.pendingEmail}
          onSignInAnyway={() => setMode('login')}
          onBackToLogin={async () => {
            await setPendingEmail('');
            setAuth({ status: 'unauthenticated', token: '', user: null, pendingEmail: '' });
            setMode('login');
          }}
        />
      </div>
    );
  }

  if (mode === 'login') {
    return (
      <div className="popup-container">
        <LoginScreen
          initialEmail={auth.pendingEmail}
          onAuthenticated={handleAuthenticated}
        />
        <div className="login-back">
          <button className="btn-ghost-muted" onClick={() => setMode('app')}>← Continue in local mode</button>
        </div>
      </div>
    );
  }

  return <AppShell
    auth={auth}
    cloudSettings={cloudSettings}
    localSettings={localSettings}
    history={history}
    templates={templates}
    activeTab={activeTab}
    setActiveTab={setActiveTab}
    onOpenLogin={() => setMode('login')}
    onLogout={handleLogout}
    onCloudPatch={onCloudPatch}
    onLocalPatch={onLocalPatch}
    onVerifyKey={onVerifyKey}
    onAddHistory={onAddHistory}
    onDeleteHistory={onDeleteHistory}
    onClearHistory={onClearHistory}
    onCreateTemplate={onCreateTemplate}
    onUpdateTemplate={onUpdateTemplate}
    onDeleteTemplate={onDeleteTemplate}
    onResyncFromCloud={onResyncFromCloud}
  />;
}

interface ShellProps {
  auth: AuthState;
  cloudSettings: CloudSettings;
  localSettings: LocalSettings;
  history: HistoryItem[];
  templates: Template[];
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  onOpenLogin: () => void;
  onLogout: () => Promise<void>;
  onCloudPatch: (patch: Partial<CloudSettings>) => Promise<void>;
  onLocalPatch: (patch: Partial<LocalSettings>) => Promise<void>;
  onVerifyKey: (p: 'groq' | 'gemini', k: string) => Promise<{ valid: boolean; error?: string }>;
  onAddHistory: (entry: Omit<HistoryItem, 'id' | 'timestamp'>) => Promise<void>;
  onDeleteHistory: (id: string, remoteId?: number) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onCreateTemplate: (t: Omit<Template, 'id'>) => Promise<void>;
  onUpdateTemplate: (id: string, patch: Partial<Template>) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onResyncFromCloud: () => Promise<void>;
}

function AppShell(props: ShellProps) {
  const {
    auth, cloudSettings, localSettings, history, templates, activeTab, setActiveTab,
    onOpenLogin, onLogout, onCloudPatch, onLocalPatch, onVerifyKey,
    onAddHistory, onDeleteHistory, onClearHistory,
    onCreateTemplate, onUpdateTemplate, onDeleteTemplate, onResyncFromCloud,
  } = props;

  const activeKey = cloudSettings.preferred_provider === 'groq'
    ? cloudSettings.groq_api_key : cloudSettings.gemini_api_key;
  const hasApiKey = activeKey.length > 0;

  const tabs = useMemo(() => ([
    { id: 'home' as Tab, icon: <ShieldCheck style={{ width: 13, height: 13 }} strokeWidth={1.6} />, label: 'Home' },
    { id: 'enhance' as Tab, icon: <Zap style={{ width: 13, height: 13 }} strokeWidth={1.6} />, label: 'Enhance' },
    { id: 'history' as Tab, icon: <HistoryIcon style={{ width: 13, height: 13 }} strokeWidth={1.6} />, label: 'History' },
    { id: 'templates' as Tab, icon: <BookTemplate style={{ width: 13, height: 13 }} strokeWidth={1.6} />, label: 'Templates' },
    { id: 'settings' as Tab, icon: <SettingsIcon style={{ width: 13, height: 13 }} strokeWidth={1.6} />, label: 'Settings' },
  ]), []);

  return (
    <div className="popup-container">
      <div className="glow glow-top" />
      <div className="glow glow-bottom" />

      <Header user={auth.user} onLogout={onLogout} onOpenLogin={onOpenLogin} />

      <nav className="tab-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <HomeTab
              user={auth.user}
              cloudSettings={cloudSettings}
              history={history}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'enhance' && (
            <EnhanceTab cloudSettings={cloudSettings} onResult={onAddHistory} />
          )}
          {activeTab === 'history' && (
            <HistoryTab
              history={history}
              onDelete={onDeleteHistory}
              onClearAll={onClearHistory}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesTab
              templates={templates}
              isLoggedIn={!!auth.user}
              onCreate={onCreateTemplate}
              onUpdate={onUpdateTemplate}
              onDelete={onDeleteTemplate}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              user={auth.user}
              cloudSettings={cloudSettings}
              localSettings={localSettings}
              onCloudPatch={onCloudPatch}
              onLocalPatch={onLocalPatch}
              onVerifyKey={onVerifyKey}
              onLogout={onLogout}
              onOpenLogin={onOpenLogin}
              onResyncFromCloud={onResyncFromCloud}
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="footer">
        <div className={`status-dot ${hasApiKey ? 'active' : ''}`} />
        {hasApiKey
          ? `${cloudSettings.preferred_provider === 'groq' ? '⚡ Groq' : '✦ Gemini'} ready${auth.user ? ' · synced' : ' · local'}`
          : 'API key required — see Settings'}
      </footer>
    </div>
  );
}

export default App;
