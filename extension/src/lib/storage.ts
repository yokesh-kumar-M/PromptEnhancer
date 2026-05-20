import type {
  AuthState, CloudSettings, HistoryItem,
  LocalSettings, Template, User,
} from './types';
import { DEFAULT_BACKEND_URL } from './constants';

const hasChromeStorage = () =>
  typeof chrome !== 'undefined' && !!chrome.storage?.local;

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  backendUrl: DEFAULT_BACKEND_URL,
  autoDetect: true,
  historyLimit: 50,
};

export const DEFAULT_CLOUD_SETTINGS: CloudSettings = {
  preferred_provider: 'gemini',
  preferred_model: '',
  groq_api_key: '',
  gemini_api_key: '',
  theme: 'dark',
  density: 'comfortable',
  cloud_sync_enabled: true,
};

export async function getLocal<T = unknown>(keys: string[]): Promise<Record<string, T>> {
  if (!hasChromeStorage()) return {};
  return new Promise((resolve) =>
    chrome.storage.local.get(keys, (result) => resolve(result as Record<string, T>))
  );
}

export async function setLocal(obj: Record<string, unknown>): Promise<void> {
  if (!hasChromeStorage()) return;
  return new Promise((resolve) => chrome.storage.local.set(obj, () => resolve()));
}

export async function getAuth(): Promise<AuthState> {
  const r = await getLocal<unknown>(['extToken', 'extUser', 'pendingEmail']);
  const token = (r.extToken as string) || '';
  const user = (r.extUser as User | undefined) || null;
  const pendingEmail = (r.pendingEmail as string) || '';
  if (token && user) return { status: 'authenticated', token, user, pendingEmail: '' };
  if (pendingEmail) return { status: 'pending', token: '', user: null, pendingEmail };
  return { status: 'unauthenticated', token: '', user: null, pendingEmail: '' };
}

export async function saveAuth(token: string, user: User): Promise<void> {
  await setLocal({ extToken: token, extUser: user, pendingEmail: '' });
}

export async function clearAuth(): Promise<void> {
  await setLocal({ extToken: '', extUser: null });
}

export async function setPendingEmail(email: string): Promise<void> {
  await setLocal({ pendingEmail: email });
}

export async function clearPendingEmail(): Promise<void> {
  await setLocal({ pendingEmail: '' });
}

export async function getLocalSettings(): Promise<LocalSettings> {
  const r = await getLocal<LocalSettings>(['settings']);
  return { ...DEFAULT_LOCAL_SETTINGS, ...(r.settings || {}) };
}

export async function saveLocalSettings(patch: Partial<LocalSettings>): Promise<LocalSettings> {
  const current = await getLocalSettings();
  const next = { ...current, ...patch };
  await setLocal({ settings: next });
  return next;
}

export async function getCloudSettingsLocal(): Promise<CloudSettings> {
  const r = await getLocal<CloudSettings>(['cloudSettings']);
  return { ...DEFAULT_CLOUD_SETTINGS, ...(r.cloudSettings || {}) };
}

export async function saveCloudSettingsLocal(s: CloudSettings): Promise<void> {
  await setLocal({ cloudSettings: s });
}

export async function getLocalHistory(): Promise<HistoryItem[]> {
  const r = await getLocal<HistoryItem[]>(['promptHistory']);
  return r.promptHistory || [];
}

export async function setLocalHistory(items: HistoryItem[]): Promise<void> {
  await setLocal({ promptHistory: items.slice(0, 200) });
}

export async function getLocalTemplates(): Promise<Template[]> {
  const r = await getLocal<Template[]>(['customTemplates']);
  return r.customTemplates || [];
}

export async function setLocalTemplates(items: Template[]): Promise<void> {
  await setLocal({ customTemplates: items });
}

/** Apply theme/density to <html> for instant feedback. */
export function applyAppearance(theme: 'dark' | 'light' | 'auto', density: 'comfortable' | 'compact') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let resolved: 'dark' | 'light' = 'dark';
  if (theme === 'auto') {
    resolved = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } else {
    resolved = theme;
  }
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-density', density);
}
