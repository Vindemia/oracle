import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext.js';

// Wrapper minimal pour les composants qui appellent useTheme() (TaskCard, FocusView…)
// et/ou useNavigate() (FocusView). ThemeProvider tolère l'absence d'AuthProvider
// (cf. commentaire dans ThemeContext.tsx) — pas besoin de mocker l'auth ici.
// Si un composant a besoin d'AuthContext ou de ToastContext, compose-les autour
// de <AllProviders> dans le test concerné plutôt que d'alourdir ce helper.
function AllProviders({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <ThemeProvider>{children}</ThemeProvider>
    </MemoryRouter>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
