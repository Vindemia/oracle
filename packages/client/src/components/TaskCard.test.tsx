import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '../test/render.js';
import { ThemeProvider } from '../context/ThemeContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { ToastList } from './ToastList.js';
import { TaskCard } from './TaskCard.js';
import type { Task } from '../types/index.js';

// TaskCard consomme useToast() (toast d'erreur sur l'ajout de fragment, toast
// d'annulation v3-17) en plus de useTheme() — le helper renderWithProviders ne
// fournit pas ToastProvider (cf. commentaire dans test/render.tsx), on compose
// donc ici, avec <ToastList /> pour pouvoir observer les toasts rendus.
function renderTaskCard(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <ToastProvider>
          {ui}
          <ToastList />
        </ToastProvider>
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
        onReactivate={noop}
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
        onReactivate={noop}
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

describe('TaskCard — Annulation (v3-17)', () => {
  it('compléter affiche un toast « Annuler » qui appelle onReactivate', async () => {
    const onComplete = vi.fn(noop);
    const onReactivate = vi.fn(noop);
    renderTaskCard(
      <TaskCard
        task={baseTask}
        allTags={[]}
        onComplete={onComplete}
        onEliminate={noop}
        onReactivate={onReactivate}
        onUpdate={noop}
        onUpdateTags={noop}
        onDelete={noop}
        onAddStep={noop}
        onToggleStep={noop}
        onRemoveStep={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Compléter' }));

    const undoBtn = await screen.findByText('Annuler');
    expect(onComplete).toHaveBeenCalledWith('task-1');
    fireEvent.click(undoBtn);
    expect(onReactivate).toHaveBeenCalledWith('task-1');
  });

  it('éliminer (quadrant MIST) affiche aussi un toast « Annuler »', async () => {
    const onEliminate = vi.fn(noop);
    const onReactivate = vi.fn(noop);
    const { container } = renderTaskCard(
      <TaskCard
        task={{ ...baseTask, quadrant: 'MIST' }}
        allTags={[]}
        onComplete={noop}
        onEliminate={onEliminate}
        onReactivate={onReactivate}
        onUpdate={noop}
        onUpdateTags={noop}
        onDelete={noop}
        onAddStep={noop}
        onToggleStep={noop}
        onRemoveStep={noop}
      />,
    );

    // Le libellé du bouton circle dépend du thème ('Éliminer' vs 'Supprimer') —
    // on cible par classe plutôt que par nom accessible pour rester agnostique.
    const circleBtn = container.querySelector<HTMLButtonElement>('[class*="circle"]');
    expect(circleBtn).not.toBeNull();
    fireEvent.click(circleBtn as HTMLButtonElement);

    const undoBtn = await screen.findByText('Annuler');
    expect(onEliminate).toHaveBeenCalledWith('task-1');
    fireEvent.click(undoBtn);
    expect(onReactivate).toHaveBeenCalledWith('task-1');
  });

  it('cliquer sur le fond du toast le ferme sans annuler (pas de propagation depuis le bouton)', async () => {
    const onComplete = vi.fn(noop);
    const onReactivate = vi.fn(noop);
    renderTaskCard(
      <TaskCard
        task={baseTask}
        allTags={[]}
        onComplete={onComplete}
        onEliminate={noop}
        onReactivate={onReactivate}
        onUpdate={noop}
        onUpdateTags={noop}
        onDelete={noop}
        onAddStep={noop}
        onToggleStep={noop}
        onRemoveStep={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Compléter' }));
    // baseTask est en STARS : getCompleteToast(quadrant, false, false) retourne toujours ce message.
    const message = await screen.findByText('✦ Vision accomplie !');
    fireEvent.click(message);

    await waitFor(() => {
      expect(screen.queryByText('Annuler')).not.toBeInTheDocument();
    });
    expect(onReactivate).not.toHaveBeenCalled();
  });
});
