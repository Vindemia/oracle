import { useMemo } from 'react';
import { QuadrantPanel } from '../components/QuadrantPanel.js';
import type { Quadrant, Task } from '../types/index.js';
import styles from './MatrixView.module.css';

const QUADRANT_ORDER: Quadrant[] = ['FIRE', 'STARS', 'WIND', 'MIST'];

interface MatrixViewProps {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  onComplete: (id: string) => Promise<void>;
  onEliminate: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Pick<Task, 'urgent' | 'important'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function MatrixView({ tasks, isLoading, error, onComplete, onEliminate, onUpdate, onDelete }: MatrixViewProps) {
  const tasksByQuadrant = useMemo(() => {
    const map: Record<Quadrant, Task[]> = { FIRE: [], STARS: [], WIND: [], MIST: [] };
    for (const task of tasks) {
      map[task.quadrant].push(task);
    }
    return map;
  }, [tasks]);

  if (isLoading) {
    return (
      <div className={styles.feedback}>
        <span>Consultation des astres…</span>
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

  return (
    <div className={styles.grid}>
      {QUADRANT_ORDER.map((q) => (
        <QuadrantPanel
          key={q}
          quadrant={q}
          tasks={tasksByQuadrant[q]}
          onComplete={onComplete}
          onEliminate={onEliminate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
