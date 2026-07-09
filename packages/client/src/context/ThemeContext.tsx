import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_THEME_ID, getTheme } from '../themes/index.js';
import type { Theme, TermKey } from '../themes/index.js';
import { AuthContext } from './AuthContext.js';

const STORAGE_KEY = 'oracle:themeId';

export interface ThemeContextValue {
  theme: Theme;
  /** Change le thème localement (optimistic) — la persistance serveur est à la charge de l'appelant. */
  setThemeId: (id: string) => void;
  /** Résout un terme du lexique du thème courant. */
  t: (key: TermKey) => string;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredThemeId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;
  } catch {
    // localStorage indisponible (navigation privée stricte…) — repli sur le défaut
    return DEFAULT_THEME_ID;
  }
}

function persistThemeId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // best-effort — l'absence de persistance locale ne doit jamais bloquer l'app
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Pas de useAuth() ici : useAuth() lève si hors AuthProvider, alors que
  // ThemeProvider doit pouvoir être monté seul (tests, Storybook…).
  const auth = useContext(AuthContext);
  const [themeId, setThemeIdState] = useState<string>(readStoredThemeId);

  // Dernier thème connu en localStorage appliqué immédiatement (pas de flash) ;
  // dès que la session est restaurée, la préférence serveur fait autorité.
  useEffect(() => {
    const serverThemeId = auth?.user?.themeId;
    if (serverThemeId !== undefined) {
      setThemeIdState(serverThemeId);
      persistThemeId(serverThemeId);
    }
  }, [auth?.user?.themeId]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
  }, [themeId]);

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    persistThemeId(id);
  }, []);

  const theme = useMemo(() => getTheme(themeId), [themeId]);
  const t = useCallback((key: TermKey) => theme.lexicon[key], [theme]);
  const value = useMemo(() => ({ theme, setThemeId, t }), [theme, setThemeId, t]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  return ctx;
}
