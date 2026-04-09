import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Tag, Task, Quadrant } from '../types/index.js';
import { getQuadrantMeta } from '../utils/quadrant.js';
import { TaskCard } from './TaskCard.js';
import styles from './QuadrantPanel.module.css';

interface SortableTaskCardProps {
  task: Task;
  allTags: Tag[];
  onComplete: (id: string) => Promise<void>;
  onEliminate: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Pick<Task, 'urgent' | 'important'>>) => Promise<void>;
  onUpdateTags: (id: string, newTags: Tag[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUnplan?: (id: string) => Promise<void>;
  onPlan?: (id: string, date: string) => Promise<void>;
}

function SortableTaskCard({ task, allTags, onComplete, onEliminate, onUpdate, onUpdateTags, onDelete, onUnplan, onPlan }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const wrapperStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      className={[styles.sortableWrapper, isDragging ? styles.draggingWrapper : undefined].filter(Boolean).join(' ')}
      {...attributes}
      {...(listeners ?? {})}
    >
      <TaskCard
        task={task}
        allTags={allTags}
        onComplete={onComplete}
        onEliminate={onEliminate}
        onUpdate={onUpdate}
        onUpdateTags={onUpdateTags}
        onDelete={onDelete}
        {...(onUnplan !== undefined ? { onUnplan } : {})}
        {...(onPlan !== undefined ? { onPlan } : {})}
      />
    </div>
  );
}

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
  onPlan?: (id: string, date: string) => Promise<void>;
}

export function QuadrantPanel({ quadrant, tasks, allTags, onComplete, onEliminate, onUpdate, onUpdateTags, onDelete, onUnplan, onPlan }: QuadrantPanelProps) {
  const meta = getQuadrantMeta(quadrant);
  const { setNodeRef, isOver } = useDroppable({ id: quadrant });

  return (
    <div
      ref={setNodeRef}
      className={[styles.panel, isOver ? styles.dragOver : undefined].filter(Boolean).join(' ')}
      style={{
        backgroundColor: `var(${meta.bgVar})`,
        borderColor: isOver ? `var(${meta.colorVar})` : `var(${meta.borderVar})`,
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
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                allTags={allTags}
                onComplete={onComplete}
                onEliminate={onEliminate}
                onUpdate={onUpdate}
                onUpdateTags={onUpdateTags}
                onDelete={onDelete}
                {...(onUnplan !== undefined ? { onUnplan } : {})}
                {...(onPlan !== undefined ? { onPlan } : {})}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}
