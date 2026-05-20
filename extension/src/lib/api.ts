import type { CloudSettings, User } from './types';
import { getLocalSettings } from './storage';

async function apiCall<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    token?: string;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 20000 } = options;
  const settings = await getLocalSettings();
  const url = `${settings.backendUrl}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Token ${token}`;

  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body !== undefined && method !== 'GET') init.body = JSON.stringify(body);

  const resp = await fetch(url, init);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err: Error & { status?: number; payload?: unknown } = new Error(
      (data as { error?: string }).error || `Request failed (${resp.status})`
    );
    err.status = resp.status;
    err.payload = data;
    throw err;
  }
  return data as T;
}

export async function loginExtension(email: string, password: string): Promise<{
  token: string; user: User; settings: CloudSettings;
}> {
  return apiCall('/api/extension/login/', {
    method: 'POST',
    body: { email, password },
  });
}

export async function logoutExtension(token: string): Promise<void> {
  try { await apiCall('/api/extension/logout/', { method: 'POST', token }); } catch { /* fire-and-forget */ }
}

export async function checkAccess(email: string): Promise<{
  has_account: boolean; status: 'approved' | 'pending' | 'rejected' | 'none';
}> {
  return apiCall('/api/extension/check-access/', {
    method: 'POST',
    body: { email },
  });
}

export async function fetchMe(token: string): Promise<{ user: User; settings: CloudSettings }> {
  return apiCall('/api/extension/me/', { token });
}

export async function patchSettings(token: string, patch: Partial<CloudSettings>): Promise<{ settings: CloudSettings }> {
  return apiCall('/api/extension/settings/', {
    method: 'PATCH',
    body: patch,
    token,
  });
}

export async function fetchHistory(token: string, limit = 50): Promise<{
  entries: {
    id: number;
    action: string;
    provider: string;
    model_used: string;
    original_text: string;
    enhanced_text: string;
    domain: string;
    created_at: string;
  }[];
}> {
  return apiCall(`/api/extension/history/?limit=${limit}`, { token });
}

export async function postHistory(token: string, body: {
  action: string;
  provider: string;
  model: string;
  original: string;
  enhanced: string;
  domain: string;
}): Promise<{ entry: { id: number; created_at: string } }> {
  return apiCall('/api/extension/history/', { method: 'POST', token, body });
}

export async function deleteHistory(token: string, id?: number): Promise<void> {
  const path = id ? `/api/extension/history/?id=${id}` : '/api/extension/history/';
  await apiCall(path, { method: 'DELETE', token });
}

export async function fetchTemplates(token: string): Promise<{
  templates: { id: number; shortcut: string; title: string; content: string; category: string; is_default: boolean }[];
}> {
  return apiCall('/api/extension/templates/', { token });
}

export interface TemplateUpsertBody {
  shortcut?: string;
  title?: string;
  content?: string;
  category?: string;
}

export async function createTemplate(token: string, body: TemplateUpsertBody): Promise<{
  template: { id: number; shortcut: string; title: string; content: string; category: string; is_default: boolean };
}> {
  return apiCall('/api/extension/templates/', { method: 'POST', token, body });
}

export async function updateTemplate(token: string, body: TemplateUpsertBody & { id: number }): Promise<{
  template: { id: number; shortcut: string; title: string; content: string; category: string; is_default: boolean };
}> {
  return apiCall('/api/extension/templates/', { method: 'PATCH', token, body });
}

export async function deleteTemplate(token: string, id: number): Promise<void> {
  await apiCall(`/api/extension/templates/?id=${id}`, { method: 'DELETE', token });
}
