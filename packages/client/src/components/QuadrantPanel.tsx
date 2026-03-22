import type { Task, Quadrant } from '../types/index.js';
import { getQuadrantMeta } from '../utils/quadrant.js';
import { TaskCard } from './TaskCard.js';
import styles from './QuadrantPanel.module.css';

interface QuadrantPanelProps {
  quadrant: Quadrant;
  tasks: Task[];
  onComplete: (id: string) => Promise<void>;
  onEliminate: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Pick<Task, 'urgent' | 'important'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function QuadrantPanel({ quadrant, tasks, onComplete, onEliminate, onUpdate, onDelete }: QuadrantPanelProps) {
  const meta = getQuadrantMeta(quadrant);

  return (
    <div
      className={styles.panel}
      style={{
        backgroundColor: `var(${meta.bgVar})`,
        borderColor: `var(${meta.borderVar})`,
      }}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}>{meta.icon}</span>
          <div>
            <div className={styles.label} style={{ color: `var(${meta.colorVar})` }}>
              {meta.label}
            </div>
            <div className={styles.description}>{meta.description}</div>
          </div>
        </div>
        <span className={styles.count}>{tasks.length}</span>
      </div>

      <div className={styles.taskList}>
        {tasks.length === 0 ? (
          <p className={styles.empty}>Aucune vision ici</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              onEliminate={onEliminate}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
