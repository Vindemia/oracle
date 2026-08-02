import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '../test/render.js';
import { ThemeProvider } from '../context/ThemeContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { ToastList } from '../components/ToastList.js';
import { FocusView } from './FocusView.js';
import type { Task } from '../types/index.js';

// FocusView consomme désormais useToast() (toast d'annulation, v3-17) —
// même raison que dans TaskCard.test.tsx : composer ToastProvider ici plutôt
// que d'alourdir le helper partagé. Passé en `wrapper` (pas englobé
// manuellement) pour que les `rerender(...)` ultérieurs du test réappliquent
// automatiquement les providers.
function FocusAllProviders({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <ToastProvider>
          {children}
          <ToastList />
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function renderFocusView(ui: ReactElement) {
  return render(ui, { wrapper: FocusAllProviders });
}

function makeFireTask(steps: Task['steps']): Task {
  return {
    id: 'fire-1',
    title: 'Éteindre le feu',
    urgent: true,
    important: true,
    quadrant: 'FIRE',
    status: 'ACTIVE',
    position: 0,
    userId: 'u1',
    tags: [],
    steps,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    plannedFor: null,
    notes: null,
  };
}

function noop() {
  return Promise.resolve();
}

describe('FocusView — enchaînement des fragments (Phase Action)', () => {
  it('affiche le fragment suivant, l\'enchaîne au clic, et propose la complétion sans compléter automatiquement', () => {
    const onToggleStep = vi.fn(noop);
    const onComplete = vi.fn(noop);

    const stepsInitial: Task['steps'] = [
      { id: 's1', title: 'Ouvrir le dossier', done: false, position: 0 },
      { id: 's2', title: 'Signer la page 3', done: false, position: 1 },
    ];

    const { rerender } = renderFocusView(
      <FocusView
        tasks={[makeFireTask(stepsInitial)]}
        isLoading={false}
        allTags={[]}
        onPlan={noop}
        onPass={noop}
        onComplete={onComplete}
        onPassFire={noop}
        onToggleStep={onToggleStep}
        onReactivate={noop}
      />,
    );

    // 1) Le premier fragment non fait est mis en avant, pas le second.
    expect(screen.getByText('Ouvrir le dossier')).toBeInTheDocument();
    expect(screen.queryByText('Signer la page 3')).not.toBeInTheDocument();

    // 2) Cocher le fragment affiché appelle bien le handler avec la bonne tâche/fragment.
    fireEvent.click(screen.getByRole('checkbox', { name: 'étape : Ouvrir le dossier' }));
    expect(onToggleStep).toHaveBeenCalledTimes(1);
    expect(onToggleStep).toHaveBeenCalledWith('fire-1', 's1');

    // 3) Le hook appliquerait l'update optimiste ; on simule le re-render avec le
    //    nouvel état des tâches pour vérifier que le fragment suivant apparaît.
    const stepsAfterFirst: Task['steps'] = [
      { id: 's1', title: 'Ouvrir le dossier', done: true, position: 0 },
      { id: 's2', title: 'Signer la page 3', done: false, position: 1 },
    ];
    rerender(
      <FocusView
        tasks={[makeFireTask(stepsAfterFirst)]}
        isLoading={false}
        allTags={[]}
        onPlan={noop}
        onPass={noop}
        onComplete={onComplete}
        onPassFire={noop}
        onToggleStep={onToggleStep}
        onReactivate={noop}
      />,
    );
    expect(screen.getByText('Signer la page 3')).toBeInTheDocument();
    expect(screen.queryByText('Ouvrir le dossier')).not.toBeInTheDocument();

    // 4) Cocher le dernier fragment.
    fireEvent.click(screen.getByRole('checkbox', { name: 'étape : Signer la page 3' }));
    expect(onToggleStep).toHaveBeenCalledTimes(2);
    expect(onToggleStep).toHaveBeenCalledWith('fire-1', 's2');

    // 5) Tous les fragments sont faits : la vision n'est JAMAIS complétée
    //    automatiquement (principe « jamais de punition / jamais d'automatisme
    //    qui décide à la place de l'utilisateur »). Le bouton « C'est fait ✓ »
    //    reste une proposition — cliquable, pas déclenché tout seul.
    const stepsAllDone: Task['steps'] = [
      { id: 's1', title: 'Ouvrir le dossier', done: true, position: 0 },
      { id: 's2', title: 'Signer la page 3', done: true, position: 1 },
    ];
    rerender(
      <FocusView
        tasks={[makeFireTask(stepsAllDone)]}
        isLoading={false}
        allTags={[]}
        onPlan={noop}
        onPass={noop}
        onComplete={onComplete}
        onPassFire={noop}
        onToggleStep={onToggleStep}
        onReactivate={noop}
      />,
    );

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /C'est fait/ })).toBeEnabled();
  });
});

describe('FocusView — Annulation (v3-17)', () => {
  it('compléter la Phase Action affiche un toast « Annuler » qui appelle onReactivate', async () => {
    const onComplete = vi.fn(noop);
    const onReactivate = vi.fn(noop);

    renderFocusView(
      <FocusView
        tasks={[makeFireTask([])]}
        isLoading={false}
        allTags={[]}
        onPlan={noop}
        onPass={noop}
        onComplete={onComplete}
        onPassFire={noop}
        onToggleStep={noop}
        onReactivate={onReactivate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /C'est fait/ }));

    const undoBtn = await screen.findByText('Annuler');
    await waitFor(() => { expect(onComplete).toHaveBeenCalledWith('fire-1'); });
    fireEvent.click(undoBtn);
    expect(onReactivate).toHaveBeenCalledWith('fire-1');
  });
});
