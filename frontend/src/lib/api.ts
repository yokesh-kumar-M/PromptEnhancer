const BASE_URL: string = import.meta.env.VITE_BACKEND_URL || ''

function getToken(): string | null {
  return localStorage.getItem('token')
}

export function saveToken(token: string) {
  localStorage.setItem('token', token)
}

export function clearToken() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function saveUser(user: AuthUser) {
  localStorage.setItem('user', JSON.stringify(user))
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

async function req(path: string, options: RequestInit = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Token ${token}`

  return fetch(`${BASE_URL}${path}`, { ...options, headers })
}

export interface AuthUser {
  id: number
  name: string
  email: string
  is_staff: boolean
}

export interface AccessRequestItem {
  id: number
  email: string
  name: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  processed_at: string | null
}

export const api = {
  login: (email: string, password: string) =>
    req('/api/auth/login/', { method: 'POST', body: JSON.stringify({ email, password }) }),

  logout: () => req('/api/auth/logout/', { method: 'POST' }),

  requestAccess: (data: { name: string; email: string; reason: string }) =>
    req('/api/auth/request-access/', { method: 'POST', body: JSON.stringify(data) }),

  me: () => req('/api/auth/me/'),

  dashboardStats: () => req('/api/dashboard/stats/'),

  adminEnhance: (text: string, action: string) =>
    req('/api/admin/enhance/', { method: 'POST', body: JSON.stringify({ text, action }) }),

  adminAccessRequests: () => req('/api/admin/access-requests/'),

  adminApproveRequest: (id: number) =>
    req(`/api/admin/access-requests/${id}/approve/`, { method: 'POST' }),

  adminRejectRequest: (id: number) =>
    req(`/api/admin/access-requests/${id}/reject/`, { method: 'POST' }),
}
