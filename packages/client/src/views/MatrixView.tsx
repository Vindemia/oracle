import { useMemo } from 'react';
import { useTasks } from '../hooks/useTasks.js';
import { QuadrantPanel } from '../components/QuadrantPanel.js';
import type { Quadrant, Task } from '../types/index.js';
import styles from './MatrixView.module.css';

const QUADRANT_ORDER: Quadrant[] = ['FIRE', 'STARS', 'WIND', 'MIST'];

export function MatrixView() {
  const { tasks, isLoading, error } = useTasks();

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
        <QuadrantPanel key={q} quadrant={q} tasks={tasksByQuadrant[q]} />
      ))}
    </div>
  );
}
