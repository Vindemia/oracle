import { useCallback, useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { QuadrantPanel } from '../components/QuadrantPanel.js';
import { EmptyState } from '../components/EmptyState.js';
import type { Quadrant, Tag, Task } from '../types/index.js';
import styles from './MatrixView.module.css';

const QUADRANT_ORDER: Quadrant[] = ['FIRE', 'STARS', 'WIND', 'MIST'];

const QUADRANT_FLAGS: Record<Quadrant, { urgent: boolean; important: boolean }> = {
  FIRE:  { urgent: true,  important: true  },
  STARS: { urgent: false, important: true  },
  WIND:  { urgent: true,  important: false },
  MIST:  { urgent: false, important: false },
};

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Détecter si le drop est sur un panel (quadrant) ou sur une tâche
    const isOverPanel = (QUADRANT_ORDER as string[]).includes(overId);
    const targetQuadrant: Quadrant | undefined = isOverPanel
      ? (overId as Quadrant)
      : tasks.find((t) => t.id === overId)?.quadrant;

    if (!targetQuadrant) return;

    if (activeTask.quadrant === targetQuadrant) {
      // Même cadrant : réordonnancement
      if (!isOverPanel) {
        const panelTasks = tasksByQuadrant[targetQuadrant];
        const oldIdx = panelTasks.findIndex((t) => t.id === activeId);
        const newIdx = panelTasks.findIndex((t) => t.id === overId);
        if (oldIdx !== -1 && newIdx !== -1) {
          void onReorder(targetQuadrant, arrayMove(panelTasks, oldIdx, newIdx).map((t) => t.id));
        }
      }
    } else {
      // Cadrant différent : déplacement inter-cadrant
      void onUpdate(activeId, QUADRANT_FLAGS[targetQuadrant]);
    }
  }, [tasks, tasksByQuadrant, onReorder, onUpdate]);

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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
            {...(onUnplan !== undefined ? { onUnplan } : {})}
            {...(onPlan !== undefined ? { onPlan } : {})}
          />
        ))}
      </div>
    </DndContext>
  );
}
