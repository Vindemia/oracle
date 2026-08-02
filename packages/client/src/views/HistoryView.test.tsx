import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../test/render.js';
import { HistoryView } from './HistoryView.js';
import type { Task } from '../types/index.js';

vi.mock('../api/client.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client.js');

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Vision archivée',
    urgent: false,
    important: true,
    quadrant: 'STARS',
    status: 'DONE',
    position: 0,
    userId: 'u1',
    tags: [],
    steps: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T10:00:00.000Z',
    plannedFor: null,
    notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('HistoryView — Annulation (v3-17)', () => {
  it('remettre en place une tâche DONE appelle reactivate et la retire de la liste', async () => {
    const done = makeTask();
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/tasks?status=DONE') return Promise.resolve([done]);
      return Promise.resolve([]);
    });
    vi.mocked(api.post).mockResolvedValue({});

    renderWithProviders(<HistoryView />);

    expect(await screen.findByText('Vision archivée')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remettre en place/ }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/tasks/task-1/reactivate', {});
    });
    await waitFor(() => {
      expect(screen.queryByText('Vision archivée')).not.toBeInTheDocument();
    });
  });

  it('remettre en place une tâche ELIMINATED fonctionne aussi', async () => {
    const eliminated = makeTask({ id: 'task-2', title: 'Vision éliminée', status: 'ELIMINATED' });
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/tasks?status=ELIMINATED') return Promise.resolve([eliminated]);
      return Promise.resolve([]);
    });
    vi.mocked(api.post).mockResolvedValue({});

    renderWithProviders(<HistoryView />);

    expect(await screen.findByText('Vision éliminée')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remettre en place/ }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/tasks/task-2/reactivate', {});
    });
    await waitFor(() => {
      expect(screen.queryByText('Vision éliminée')).not.toBeInTheDocument();
    });
  });

  it('un échec de reactivate laisse la tâche affichée (pas de retrait optimiste)', async () => {
    const done = makeTask();
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/tasks?status=DONE') return Promise.resolve([done]);
      return Promise.resolve([]);
    });
    vi.mocked(api.post).mockRejectedValue(new Error('network'));

    renderWithProviders(<HistoryView />);

    expect(await screen.findByText('Vision archivée')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remettre en place/ }));

    await waitFor(() => { expect(api.post).toHaveBeenCalled(); });
    expect(screen.getByText('Vision archivée')).toBeInTheDocument();
  });
});
