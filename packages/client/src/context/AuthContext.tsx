import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, setAccessToken } from '../api/client.js';
import type { User } from '../types/index.js';

interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// Singleton : évite deux appels simultanés à /auth/refresh (React StrictMode en dev
// monte les effets deux fois, ce qui causerait une double rotation du refresh token).
let pendingRefresh: Promise<{ accessToken: string; user?: User } | null> | null = null;

function fetchRefresh(): Promise<{ accessToken: string; user?: User } | null> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = fetch(
    (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/auth/refresh',
    { method: 'POST', credentials: 'include' },
  )
    .then(async (res) => {
      if (!res.ok) return null;
      return res.json() as Promise<{ accessToken: string; user?: User }>;
    })
    .catch(() => null)
    .finally(() => {
      pendingRefresh = null;
    });
  return pendingRefresh;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tenter de restaurer la session via le refreshToken cookie au montage
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const data = await fetchRefresh();
        if (data) {
          setAccessToken(data.accessToken);
          const resolvedUser = data.user ?? await api.get<User>('/auth/me');
          setUser(resolvedUser);
        }
      } catch {
        // Pas de session active, on reste non authentifié
      } finally {
        setIsLoading(false);
      }
    };
    void restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (displayName: string, email: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/register', { displayName, email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
