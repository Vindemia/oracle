import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../test/render.js';
import { ConstellationView } from './ConstellationView.js';
import type { ConstellationData } from '../types/index.js';

vi.mock('../api/client.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client.js');

function makeData(overrides: Partial<ConstellationData> = {}): ConstellationData {
  return {
    activeDaysTotal: 47,
    activeDaysThisMonth: ['2026-07-01', '2026-07-03'],
    completedThisMonth: [
      { id: 'task-1', title: 'Rappeler le notaire', completedAt: '2026-07-01T10:00:00.000Z', quadrant: 'FIRE' },
      { id: 'task-2', title: 'Ranger le bureau', completedAt: '2026-07-15T10:00:00.000Z', quadrant: 'STARS' },
    ],
    eliminatedThisMonthCount: 3,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConstellationView — jours actifs & révélations (v3-05)', () => {
  it('affiche le total de jours actifs et les visions accomplies du mois', async () => {
    vi.mocked(api.get).mockResolvedValue(makeData());

    renderWithProviders(<ConstellationView />);

    expect(await screen.findByText('47')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 visions accomplies ce mois-ci
  });

  it('affiche la ligne discrète des visions éliminées', async () => {
    vi.mocked(api.get).mockResolvedValue(makeData({ eliminatedThisMonthCount: 3 }));

    renderWithProviders(<ConstellationView />);

    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('n\'affiche jamais de vocabulaire de série, de manque ou de moyenne', async () => {
    vi.mocked(api.get).mockResolvedValue(makeData());

    const { container } = renderWithProviders(<ConstellationView />);
    await screen.findByText('47');

    const text = container.textContent;
    for (const forbidden of ['série', 'manqué', 'manquée', 'consécutif', 'consécutive', 'moyenne']) {
      expect(text.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('mois vide → aucune étoile, pas d\'erreur affichée', async () => {
    vi.mocked(api.get).mockResolvedValue(makeData({
      activeDaysThisMonth: [],
      completedThisMonth: [],
      eliminatedThisMonthCount: 0,
    }));

    renderWithProviders(<ConstellationView />);

    await waitFor(() => { expect(api.get).toHaveBeenCalled(); });
    expect(screen.queryByRole('button', { name: 'Rappeler le notaire' })).not.toBeInTheDocument();
  });

  it('navigue vers le mois précédent en rappelant l\'API avec un autre paramètre month', async () => {
    vi.mocked(api.get).mockResolvedValue(makeData());
    renderWithProviders(<ConstellationView />);

    await screen.findByText('47');
    const firstCallPath = vi.mocked(api.get).mock.calls[0]?.[0] as string;

    fireEvent.click(screen.getByLabelText('Mois précédent'));

    await waitFor(() => {
      const calls = vi.mocked(api.get).mock.calls.map((c) => c[0]);
      expect(calls.some((p) => p !== firstCallPath)).toBe(true);
    });
  });

  it('les positions des étoiles sont stables entre deux rendus', async () => {
    vi.mocked(api.get).mockResolvedValue(makeData());
    renderWithProviders(<ConstellationView />);

    const star = await screen.findByRole('button', { name: 'Rappeler le notaire' });
    const before = { left: star.style.left, top: star.style.top };

    // Sélectionner une étoile déclenche un re-rendu du composant.
    fireEvent.click(star);
    fireEvent.click(star);

    const after = { left: star.style.left, top: star.style.top };
    expect(after).toEqual(before);
  });
});
