import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

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
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'aigc_auth_token';
const USER_KEY = 'aigc_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 启动时从 localStorage 恢复
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as AuthUser;
        if (parsed?.role === 'teacher' || parsed?.role === 'student') {
          setToken(savedToken);
          setUser(parsed);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsReady(true);
  }, []);

  async function login(username: string, password: string) {
    const accounts: Record<string, { password: string; role: UserRole; label: string }> = {
      teacher: { password: 'teacher123', role: 'teacher', label: '教师' },
      student: { password: 'student123', role: 'student', label: '学生' },
    };
    const account = accounts[username.trim().toLowerCase()];
    if (!account || account.password !== password) throw new Error('账号或密码不正确');
    const nextUser: AuthUser = {
      id: `mock_${account.role}`,
      username: username.trim().toLowerCase(),
      role: account.role,
    };
    const nextToken = `mock-token-${account.role}`;
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
      login, logout,
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
