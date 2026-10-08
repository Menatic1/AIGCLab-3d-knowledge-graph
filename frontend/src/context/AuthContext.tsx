import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_BASE } from '../lib/graphMap';

export type UserRole = 'teacher' | 'student';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'aigc_auth_token';
const USER_KEY = 'aigc_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 启动时从 localStorage 恢复，并向后端确认 token 仍然有效。
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (!savedToken) {
      setIsReady(true);
      return;
    }
    let fallbackUser: AuthUser | null = null;
    try {
      const parsed = savedUser ? JSON.parse(savedUser) as AuthUser : null;
      if (parsed?.role === 'teacher' || parsed?.role === 'student') fallbackUser = parsed;
    } catch { /* discard malformed cached profile */ }
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'unauthorized' : 'backend_error');
        const remote = await response.json() as AuthUser;
        setToken(savedToken);
        setUser(remote);
        localStorage.setItem(USER_KEY, JSON.stringify(remote));
      })
      .catch((error: Error) => {
        if (error.message === 'unauthorized') {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(USER_KEY);
          return;
        }
        // Keep the cached profile when the API is temporarily offline. Requests
        // will still fail visibly, while the user can retry without losing state.
        if (fallbackUser) {
          setToken(savedToken);
          setUser(fallbackUser);
        }
      })
      .finally(() => setIsReady(true));
  }, []);

  async function login(username: string, password: string) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '账号或密码不正确');
    const nextUser = data.user as AuthUser;
    const nextToken = String(data.token || '');
    if (!nextToken || !nextUser) throw new Error('登录响应缺少认证信息');
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }

  async function register(username: string, password: string, role: UserRole) {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password, role }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '注册失败');
    const nextUser = data.user as AuthUser;
    const nextToken = String(data.token || '');
    if (!nextToken || !nextUser) throw new Error('注册响应缺少认证信息');
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return (
    <AuthContext.Provider value={{
      user, token, isAuthenticated: !!token, isReady,
      login, register, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** 带认证 Token 的 fetch 封装 */
export function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(STORAGE_KEY);
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}
