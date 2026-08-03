import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createContext, type ReactNode } from 'react';
import App from './App.js';
import type { Task, User, Whisper } from './types/index.js';

/**
 * Intégration du Premier Rituel (v3-15) : rendu de l'App complète (routeur
 * réel, Header, Matrice, Rituel) avec un faux serveur en mémoire — la preuve
 * que le parcours nouveau compte → onboarding guidé → /focus fonctionne de
 * bout en bout, redirections et appels API compris.
 */

// jsdom ne fournit pas matchMedia — utilisé par InstallPrompt, monté avec AppLayout.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => { /* legacy no-op */ },
    removeListener: () => { /* legacy no-op */ },
    addEventListener: () => { /* no-op */ },
    removeEventListener: () => { /* no-op */ },
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom.localStorage/sessionStorage sont cassés sous ce runtime Node (le
// storage natif expérimental de Node masque celui de jsdom) — sans ce
// correctif, InstallPrompt (monté avec AppLayout, hors périmètre v3-15)
// plante au premier accès non protégé par try/catch. Polyfill en mémoire,
// scopé à ce fichier de test.
function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.has(key) ? store.get(key) as string : null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  try {
    window[name].setItem('__probe__', '1');
    window[name].removeItem('__probe__');
  } catch {
    Object.defineProperty(window, name, { value: makeMemoryStorage(), configurable: true });
  }
}

// vi.mock est hoisté en tête de fichier — la donnée qu'il référence doit
// l'être aussi (cf. doc vitest sur vi.hoisted).
const { FAKE_USER } = vi.hoisted(() => ({
  FAKE_USER: {
    id: 'u1',
    email: 'nouvelle@oracle.test',
    displayName: 'Nouvelle',
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    themeId: 'oracle',
  } as User,
}));

// Auth déjà authentifiée par défaut du contexte — évite de mocker le
// `fetch()` brut de la restauration de session (cf. AuthContext.tsx).
vi.mock('./context/AuthContext.js', () => {
  const AuthContext = createContext({
    user: FAKE_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });
  function AuthProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  return { AuthContext, AuthProvider };
});

vi.mock('./api/client.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setAccessToken: vi.fn(),
}));

const { api } = await import('./api/client.js');

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Vision test',
    urgent: false,
    important: false,
    quadrant: 'MIST',
    status: 'ACTIVE',
    position: 0,
    userId: 'u1',
    tags: [],
    steps: [],
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    completedAt: null,
    plannedFor: null,
    notes: null,
    starredOn: null,
    ...overrides,
  };
}

function quadrantFor(urgent: boolean, important: boolean): Task['quadrant'] {
  if (urgent && important) return 'FIRE';
  if (!urgent && important) return 'STARS';
  if (urgent && !important) return 'WIND';
  return 'MIST';
}

// Faux serveur en mémoire — partagé par toutes les instances de hooks
// (Header, MatrixRoute, RitualRoute montent chacun leur propre useRitual /
// useWhispers) pour un comportement cohérent tout au long du parcours.
let whispersStore: Whisper[] = [];
let tasksStore: Task[] = [];
let ritualCompleted = false;
let nextId = 1;

function resetFakeServer(initialTasks: Task[] = []) {
  whispersStore = [];
  tasksStore = initialTasks;
  ritualCompleted = false;
  nextId = 1;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetFakeServer();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/');

  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/tasks?status=ACTIVE') return Promise.resolve(tasksStore);
    if (path === '/tags') return Promise.resolve([]);
    if (path === '/whispers') return Promise.resolve(whispersStore);
    if (path === '/ritual/status') {
      return Promise.resolve({
        ritualDoneToday: ritualCompleted,
        lastRitualOn: ritualCompleted ? '2026-08-03' : null,
        whisperCount: whispersStore.length,
        starredToday: tasksStore.filter((t) => t.starredOn !== null),
        suggestions: [],
      });
    }
    return Promise.resolve([]);
  });

  vi.mocked(api.post).mockImplementation((path: string, body?: unknown) => {
    if (path === '/whispers') {
      const w: Whisper = {
        id: 'w' + (nextId++).toString(),
        text: (body as { text: string }).text,
        createdAt: '2026-08-03T08:00:00.000Z',
      };
      whispersStore = [...whispersStore, w];
      return Promise.resolve(w);
    }
    const revealMatch = /^\/whispers\/(.+)\/reveal$/.exec(path);
    if (revealMatch) {
      const id = revealMatch[1] ?? '';
      const whisper = whispersStore.find((w) => w.id === id);
      whispersStore = whispersStore.filter((w) => w.id !== id);
      const { urgent, important } = body as { urgent: boolean; important: boolean };
      const task = makeTask({
        id: 'task-' + (nextId++).toString(),
        title: whisper?.text ?? '',
        urgent,
        important,
        quadrant: quadrantFor(urgent, important),
      });
      tasksStore = [...tasksStore, task];
      return Promise.resolve(task);
    }
    const starMatch = /^\/tasks\/(.+)\/star$/.exec(path);
    if (starMatch) {
      const id = starMatch[1] ?? '';
      tasksStore = tasksStore.map((t) => t.id === id ? { ...t, starredOn: '2026-08-03' } : t);
      return Promise.resolve(tasksStore.find((t) => t.id === id));
    }
    if (path === '/ritual/complete') {
      ritualCompleted = true;
      return Promise.resolve({ ritualDoneToday: true });
    }
    return Promise.resolve({});
  });
});

describe('Onboarding — Premier Rituel (v3-15), intégration App', () => {
  it('un compte tout neuf est redirigé vers /ritual?first=1 au premier rendu', async () => {
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/ritual');
    });
    expect(window.location.search).toBe('?first=1');
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('un compte avec au moins une tâche n\'est jamais redirigé', async () => {
    resetFakeServer([makeTask({ title: 'Déjà une vision' })]);

    render(<App />);

    expect(await screen.findByText('Déjà une vision')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('« Passer » ramène à la matrice et le flux ne se re-déclenche pas', async () => {
    render(<App />);

    const skip = await screen.findByText('Passer');
    fireEvent.click(skip);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });

    // Laisse le temps à un éventuel effet de redirection de se redéclencher —
    // sans le garde-fou sessionStorage, on repartirait immédiatement en boucle.
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    expect(window.location.pathname).toBe('/');
  });

  it('le flux complet capture, révèle, étoile, clôt le rituel et atterrit sur /focus', async () => {
    render(<App />);

    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'Réserver le vétérinaire' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => { expect(whispersStore).toHaveLength(1); });
    fireEvent.click(screen.getByText(/Continuer/));

    await screen.findByText('Réserver le vétérinaire');
    fireEvent.click(screen.getByRole('button', { name: /Important/i }));
    // Le libellé varie selon le thème (« Révéler » / « Ajouter ») — jamais le ✦
    // seul, qui matcherait aussi le bouton-titre « ✦ Oracle » du Header.
    fireEvent.click(screen.getByRole('button', { name: /Révéler|Ajouter/ }));

    await waitFor(() => { expect(tasksStore).toHaveLength(1); });
    expect(tasksStore[0]?.starredOn).not.toBeNull();

    fireEvent.click(await screen.findByText(/Continuer/));
    fireEvent.click(await screen.findByText(/Commencer la journée/));

    await waitFor(() => { expect(ritualCompleted).toBe(true); });
    await waitFor(() => { expect(window.location.pathname).toBe('/focus'); });
  });
});
