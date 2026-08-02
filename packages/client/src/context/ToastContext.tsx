import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastVariant = 'fire' | 'stars' | 'wind' | 'mist' | 'info' | 'error' | 'special';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
}

interface ShowToastOptions {
  /** Bouton d'action interne au toast (ex. « Annuler », v3-17) — distinct du clic de fermeture. */
  action?: ToastAction;
  /** Durée d'affichage en ms avant disparition automatique (défaut 2500). */
  durationMs?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (message: string, variant?: ToastVariant, options?: ShowToastOptions) => void;
  dismissToast: (id: string) => void;
}

const DEFAULT_DURATION_MS = 2500;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((
    message: string,
    variant: ToastVariant = 'info',
    options?: ShowToastOptions,
  ) => {
    counterRef.current += 1;
    const id = 'toast-' + counterRef.current.toString();
    setToasts((prev) => [...prev, { id, message, variant, ...(options?.action ? { action: options.action } : {}) }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options?.durationMs ?? DEFAULT_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
