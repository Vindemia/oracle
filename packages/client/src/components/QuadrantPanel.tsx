import type { Task, Quadrant } from '../types/index.js';
import { getQuadrantMeta } from '../utils/quadrant.js';
import { TaskCard } from './TaskCard.js';
import styles from './QuadrantPanel.module.css';

interface QuadrantPanelProps {
  quadrant: Quadrant;
  tasks: Task[];
}

export function QuadrantPanel({ quadrant, tasks }: QuadrantPanelProps) {
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
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
