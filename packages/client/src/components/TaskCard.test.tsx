import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '../test/render.js';
import { ThemeProvider } from '../context/ThemeContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { TaskCard } from './TaskCard.js';
import type { Task } from '../types/index.js';

// TaskCard consomme useToast() (toast d'erreur sur l'ajout de fragment) en plus
// de useTheme() — le helper renderWithProviders ne fournit pas ToastProvider
// (cf. commentaire dans test/render.tsx), on compose donc ici.
function renderTaskCard(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

const baseTask: Task = {
  id: 'task-1',
  title: 'Préparer le dossier X',
  urgent: false,
  important: true,
  quadrant: 'STARS',
  status: 'ACTIVE',
  position: 0,
  userId: 'u1',
  tags: [],
  steps: [
    { id: 's1', title: 'Fragment déjà fait', done: true, position: 0 },
    { id: 's2', title: 'Fragment suivant', done: false, position: 1 },
    { id: 's3', title: 'Fragment plus tard', done: false, position: 2 },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  plannedFor: null,
  notes: null,
};

function noop() {
  return Promise.resolve();
}

describe('TaskCard — fragments', () => {
  it('affiche le premier fragment NON fait (pas le premier tout court) avec le compteur', () => {
    renderTaskCard(
      <TaskCard
        task={baseTask}
        allTags={[]}
        onComplete={noop}
        onEliminate={noop}
        onUpdate={noop}
        onUpdateTags={noop}
        onDelete={noop}
        onAddStep={noop}
        onToggleStep={noop}
        onRemoveStep={noop}
      />,
    );

    // Le fragment déjà fait (s1) n'est pas mis en avant, seul le prochain non fait (s2) l'est.
    expect(screen.getByText('Fragment suivant')).toBeInTheDocument();
    expect(screen.queryByText('Fragment déjà fait')).not.toBeInTheDocument();
    // Compteur "1/3" : 1 fragment fait sur 3.
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('un clic sur la puce coche le fragment sans déplier la carte (stopPropagation)', () => {
    const onToggleStep = vi.fn(noop);
    renderTaskCard(
      <TaskCard
        task={baseTask}
        allTags={[]}
        onComplete={noop}
        onEliminate={noop}
        onUpdate={noop}
        onUpdateTags={noop}
        onDelete={noop}
        onAddStep={noop}
        onToggleStep={onToggleStep}
        onRemoveStep={noop}
      />,
    );

    const bullet = screen.getByRole('checkbox', { name: 'étape : Fragment suivant' });
    fireEvent.click(bullet);

    // Le handler est bien appelé avec la bonne tâche et le bon fragment.
    expect(onToggleStep).toHaveBeenCalledTimes(1);
    expect(onToggleStep).toHaveBeenCalledWith('task-1', 's2');

    // La carte ne s'est PAS dépliée : le fragment déjà fait (visible uniquement
    // dans l'éditeur complet) reste absent du DOM. Sans le stopPropagation sur
    // la puce, le clic remonterait au conteneur et déplierait la carte.
    expect(screen.queryByText('Fragment déjà fait')).not.toBeInTheDocument();
  });
});
