export type Provider = 'groq' | 'gemini';
export type Theme = 'dark' | 'light' | 'auto';
export type Density = 'comfortable' | 'compact';
export type Tab = 'home' | 'enhance' | 'history' | 'templates' | 'settings';

export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  initials: string;
  is_staff: boolean;
  is_superuser: boolean;
  total_enhancements: number;
  joined: string | null;
}

export interface CloudSettings {
  preferred_provider: Provider;
  preferred_model: string;
  groq_api_key: string;
  gemini_api_key: string;
  theme: Theme;
  density: Density;
  cloud_sync_enabled: boolean;
}

export interface LocalSettings {
  backendUrl: string;
  autoDetect: boolean;
  historyLimit: number;
}

export interface HistoryItem {
  id: string;
  remoteId?: number;
  original: string;
  enhanced: string;
  type: string;
  timestamp: number;
  domain?: string;
  provider?: string;
  model?: string;
}

export interface Template {
  id: string;
  remoteId?: number;
  shortcut: string;
  title: string;
  content: string;
  category: string;
  isDefault?: boolean;
}

export interface AuthState {
  status: 'loading' | 'unauthenticated' | 'pending' | 'authenticated';
  token: string;
  user: User | null;
  pendingEmail: string;
}
