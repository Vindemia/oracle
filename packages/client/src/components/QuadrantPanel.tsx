import { useState } from 'react';
import type { DragEvent } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface SortableTaskCardProps {
  task: Task;
  allTags: Tag[];
  onComplete: (id: string) => Promise<void>;
  onEliminate: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Pick<Task, 'urgent' | 'important'>>) => Promise<void>;
  onUpdateTags: (id: string, newTags: Tag[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUnplan?: (id: string) => Promise<void>;
}

function SortableTaskCard({ task, allTags, onComplete, onEliminate, onUpdate, onUpdateTags, onDelete, onUnplan }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const wrapperStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div ref={setNodeRef} style={wrapperStyle} className={styles.sortableWrapper}>
      <span
        className={[styles.dragHandle, isDragging ? styles.dragHandleActive : undefined].filter(Boolean).join(' ')}
        aria-label="Réordonner"
        {...attributes}
        {...(listeners ?? {})}
      >
        ⠿
      </span>
      <div className={styles.sortableCard}>
        <TaskCard
          task={task}
          allTags={allTags}
          onComplete={onComplete}
          onEliminate={onEliminate}
          onUpdate={onUpdate}
          onUpdateTags={onUpdateTags}
          onDelete={onDelete}
          onUnplan={onUnplan}
        />
      </div>
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
  onReorder: (quadrant: Quadrant, orderedIds: string[]) => Promise<void>;
  onUnplan?: (id: string) => Promise<void>;
}

export function QuadrantPanel({ quadrant, tasks, allTags, onComplete, onEliminate, onUpdate, onUpdateTags, onDelete, onReorder, onUnplan }: QuadrantPanelProps) {
  const meta = getQuadrantMeta(quadrant);
  const [isDragOver, setIsDragOver] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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

  const handleDndEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tasks, oldIndex, newIndex);
    void onReorder(quadrant, reordered.map((t) => t.id));
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDndEnd}>
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
                  onUnplan={onUnplan}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
