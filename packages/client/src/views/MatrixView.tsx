import { useMemo } from 'react';
import { QuadrantPanel } from '../components/QuadrantPanel.js';
import { EmptyState } from '../components/EmptyState.js';
import type { Quadrant, Tag, Task } from '../types/index.js';
import styles from './MatrixView.module.css';

const QUADRANT_ORDER: Quadrant[] = ['FIRE', 'STARS', 'WIND', 'MIST'];

interface MatrixViewProps {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  allTags: Tag[];
  onComplete: (id: string) => Promise<void>;
  onEliminate: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Pick<Task, 'urgent' | 'important'>>) => Promise<void>;
  onUpdateTags: (id: string, newTags: Tag[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (quadrant: Quadrant, orderedIds: string[]) => Promise<void>;
  onUnplan?: (id: string) => Promise<void>;
  onPlan?: (id: string, date: string) => Promise<void>;
  onFocusInput?: () => void;
}

export function MatrixView({ tasks, isLoading, error, allTags, onComplete, onEliminate, onUpdate, onUpdateTags, onDelete, onReorder, onUnplan, onPlan, onFocusInput }: MatrixViewProps) {
  const tasksByQuadrant = useMemo(() => {
    const map: Record<Quadrant, Task[]> = { FIRE: [], STARS: [], WIND: [], MIST: [] };
    for (const task of tasks) {
      map[task.quadrant].push(task);
    }
    return map;
  }, [tasks]);

  const allEmpty = tasks.length === 0;

  if (isLoading) {
    return (
      <div className={styles.grid}>
        {QUADRANT_ORDER.map((q) => (
          <div key={q} className={styles.skeleton} aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.feedback}>
        <span className={styles.error}>{error}</span>
      </div>
    );
  }

  if (allEmpty) {
    return (
      <div className={styles.emptyFull}>
        <EmptyState
          icon="✦"
          title="Bienvenue dans ton Oracle"
          subtitle="Ajoute ta première vision pour clarifier tes priorités."
          action={
            <button
              type="button"
              className={styles.firstVisionBtn}
              onClick={onFocusInput}
            >
              + Ma première vision
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {QUADRANT_ORDER.map((q) => (
        <QuadrantPanel
          key={q}
          quadrant={q}
          tasks={tasksByQuadrant[q]}
          allTags={allTags}
          onComplete={onComplete}
          onEliminate={onEliminate}
          onUpdate={onUpdate}
          onUpdateTags={onUpdateTags}
          onDelete={onDelete}
          onReorder={onReorder}
          {...(onUnplan !== undefined ? { onUnplan } : {})}
          {...(onPlan !== undefined ? { onPlan } : {})}
        />
      ))}
    </div>
  );
}
