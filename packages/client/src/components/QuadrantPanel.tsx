import { useState } from 'react';
import type { DragEvent } from 'react';
import type { Tag, Task, Quadrant } from '../types/index.js';
import { getQuadrantMeta } from '../utils/quadrant.js';
import { TaskCard } from './TaskCard.js';
import styles from './QuadrantPanel.module.css';

const QUADRANT_FLAGS: Record<Quadrant, { urgent: boolean; important: boolean }> = {
  FIRE:  { urgent: true,  important: true  },
  STARS: { urgent: false, important: true  },
  WIND:  { urgent: true,  important: false },
  MIST:  { urgent: false, important: false },
};

interface QuadrantPanelProps {
  quadrant: Quadrant;
  tasks: Task[];
  allTags: Tag[];
  onComplete: (id: string) => Promise<void>;
  onEliminate: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Pick<Task, 'urgent' | 'important'>>) => Promise<void>;
  onUpdateTags: (id: string, newTags: Tag[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUnplan?: (id: string) => Promise<void>;
}

export function QuadrantPanel({ quadrant, tasks, allTags, onComplete, onEliminate, onUpdate, onUpdateTags, onDelete, onUnplan }: QuadrantPanelProps) {
  const meta = getQuadrantMeta(quadrant);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    void onUpdate(taskId, QUADRANT_FLAGS[quadrant]);
  };

  return (
    <div
      className={[styles.panel, isDragOver ? styles.dragOver : undefined].filter(Boolean).join(' ')}
      style={{
        backgroundColor: `var(${meta.bgVar})`,
        borderColor: isDragOver ? `var(${meta.colorVar})` : `var(${meta.borderVar})`,
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
              allTags={allTags}
              onComplete={onComplete}
              onEliminate={onEliminate}
              onUpdate={onUpdate}
              onUpdateTags={onUpdateTags}
              onDelete={onDelete}
              onUnplan={onUnplan}
            />
          ))
        )}
      </div>
    </div>
  );
}
