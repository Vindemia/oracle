import type { Task } from '../types/index.js';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.title}>{task.title}</span>
      {task.tags.length > 0 && (
        <div className={styles.tags}>
          {task.tags.map((tag) => (
            <span key={tag.id} className={styles.tag}>{tag.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
