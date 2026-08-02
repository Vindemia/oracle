import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../test/render.js';
import { RitualView } from './RitualView.js';
import { todayKey } from '../utils/dates.js';
import type { Task } from '../types/index.js';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../api/client.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client.js');

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Rappeler le notaire',
    urgent: true,
    important: true,
    quadrant: 'FIRE',
    status: 'ACTIVE',
    position: 0,
    userId: 'u1',
    tags: [],
    steps: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    plannedFor: null,
    notes: null,
    starredOn: null,
    ...overrides,
  };
}

/** Route les GET du rituel, des murmures et des étiquettes vers des réponses de test. */
function mockGet({ whispers = [], suggestions = [] }: { whispers?: unknown[]; suggestions?: Task[] } = {}) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/ritual/status') {
      return Promise.resolve({
        ritualDoneToday: false,
        whisperCount: whispers.length,
        starredToday: [],
        suggestions,
      });
    }
    if (path === '/whispers') return Promise.resolve(whispers);
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.post).mockResolvedValue({});
});

describe('RitualView — Rituel de l\'Aube', () => {
  it('saute l\'étape des murmures quand la boîte est vide', async () => {
    mockGet({ suggestions: [makeTask()] });

    renderWithProviders(<RitualView tasks={[makeTask()]} onStar={vi.fn()} onUnstar={vi.fn()} />);

    expect(await screen.findByText('Rappeler le notaire')).toBeInTheDocument();
    expect(screen.queryByText(/à trier/)).not.toBeInTheDocument();
  });

  it('commence par le tri des murmures quand il y en a', async () => {
    mockGet({ whispers: [{ id: 'w1', text: 'penser aux impôts', createdAt: '2026-01-01T00:00:00.000Z' }] });

    renderWithProviders(<RitualView tasks={[]} onStar={vi.fn()} onUnstar={vi.fn()} />);

    expect(await screen.findByText('penser aux impôts')).toBeInTheDocument();
  });

  it('le flux aboutit à /focus et enregistre le rituel', async () => {
    mockGet({ suggestions: [makeTask()] });

    renderWithProviders(<RitualView tasks={[makeTask()]} onStar={vi.fn()} onUnstar={vi.fn()} />);

    fireEvent.click(await screen.findByText(/Continuer/));
    fireEvent.click(await screen.findByText(/Commencer la journée/));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ritual/complete', {});
    });
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/focus');
    });
  });

  it('étoile une vision au tap et affiche le compteur', async () => {
    const onStar = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
    mockGet({ suggestions: [makeTask()] });

    renderWithProviders(<RitualView tasks={[makeTask()]} onStar={onStar} onUnstar={vi.fn()} />);

    expect(await screen.findByText('0/3')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Rappeler le notaire'));

    await waitFor(() => {
      expect(onStar).toHaveBeenCalledWith('task-1');
    });
  });

  it('au-delà de 3 Étoiles, les autres visions ne sont plus sélectionnables', async () => {
    const starred = [
      makeTask({ id: 'a', title: 'A', starredOn: todayKey() }),
      makeTask({ id: 'b', title: 'B', starredOn: todayKey() }),
      makeTask({ id: 'c', title: 'C', starredOn: todayKey() }),
    ];
    const extra = makeTask({ id: 'd', title: 'D' });
    mockGet({ suggestions: [...starred, extra] });

    renderWithProviders(
      <RitualView tasks={[...starred, extra]} onStar={vi.fn()} onUnstar={vi.fn()} />,
    );

    expect(await screen.findByText('3/3')).toBeInTheDocument();
    expect(screen.getByText('D').closest('button')).toBeDisabled();
    // Retirer une Étoile reste possible — c'est ce qui libère une place.
    expect(screen.getByText('A').closest('button')).not.toBeDisabled();
  });
});
