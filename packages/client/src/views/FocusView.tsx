import { type ChangeEvent, useState } from 'react';
import type { Tag, Task } from '../types/index.js';
import { CalendarButton } from '../components/CalendarButton.js';
import { TaskInput } from '../components/TaskInput.js';
import styles from './FocusView.module.css';

function getDefaultDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getFullYear().toString() + '-'
    + (d.getMonth() + 1).toString().padStart(2, '0') + '-'
    + d.getDate().toString().padStart(2, '0') + 'T09:00';
}

interface FocusViewProps {
  tasks: Task[];
  isLoading: boolean;
  allTags: Tag[];
  onPlan: (id: string, date: string) => Promise<void>;
  onPass: (id: string) => Promise<void>;
  onTaskCreated: () => void;
}

export function FocusView({ tasks, isLoading, allTags: _allTags, onPlan, onPass, onTaskCreated }: FocusViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(getDefaultDatetime());
  const [plannedTask, setPlannedTask] = useState<Task | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isPassing, setIsPassing] = useState(false);

  const unplannedStars = tasks
    .filter((t) => t.quadrant === 'STARS' && t.status === 'ACTIVE' && t.plannedFor === null)
    .sort((a, b) => a.position - b.position);

  const currentTask = unplannedStars[0] ?? null;

  const handlePlan = async () => {
    if (!currentTask || isPlanning) return;
    setIsPlanning(true);
    try {
      const isoDate = new Date(selectedDate).toISOString();
      await onPlan(currentTask.id, isoDate);
      setPlannedTask({ ...currentTask, plannedFor: isoDate });
      setSelectedDate(getDefaultDatetime());
      setTimeout(() => {
        setPlannedTask(null);
      }, 1500);
    } finally {
      setIsPlanning(false);
    }
  };

  const handlePass = async () => {
    if (!currentTask || isPassing) return;
    setIsPassing(true);
    try {
      await onPass(currentTask.id);
    } finally {
      setIsPassing(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Consultation des étoiles...</div>
      </div>
    );
  }

  if (unplannedStars.length === 0 && plannedTask === null) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>✨</div>
          <h2 className={styles.emptyTitle}>Toutes vos étoiles sont alignées</h2>
          <p className={styles.emptySubtitle}>Passons aux visions urgentes.</p>
          <button type="button" className={styles.nextPhaseBtn}>
            Voir mes urgences →
          </button>
        </div>
        <div className={styles.taskInputArea}>
          <TaskInput onTaskCreated={onTaskCreated} isDesktop />
        </div>
      </div>
    );
  }

  const displayTask = plannedTask ?? currentTask;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* En-tête */}
        <div className={styles.header}>
          <span className={styles.quadrantBadge}>✦ Les Étoiles</span>
          <span className={styles.counter}>
            {unplannedStars.length.toString() + ' vision' + (unplannedStars.length > 1 ? 's' : '') + ' à planifier'}
          </span>
        </div>

        {/* Vision courante */}
        {displayTask !== null && (
          <div className={[styles.taskCard, plannedTask !== null ? styles.fadeIn : undefined].filter(Boolean).join(' ')}>
            <h1 className={styles.taskTitle}>{displayTask.title}</h1>

            {/* Tags */}
            {displayTask.tags.length > 0 && (
              <div className={styles.tagsRow}>
                {displayTask.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className={styles.tagBadge}
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.icon} {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* CalendarButton si vient d'être planifiée */}
            {plannedTask !== null ? (
              <div className={styles.calendarRow}>
                <span className={styles.plannedConfirm}>Vision planifiée ✓</span>
                <CalendarButton task={plannedTask} />
              </div>
            ) : (
              <>
                {/* Sélecteur de date */}
                <div className={styles.datePickerRow}>
                  <label htmlFor="focus-datetime" className={styles.dateLabel}>
                    Quand la traiter ?
                  </label>
                  <input
                    id="focus-datetime"
                    type="datetime-local"
                    className={styles.datePicker}
                    value={selectedDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => { setSelectedDate(e.target.value); }}
                  />
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.planBtn}
                    onClick={() => { void handlePlan(); }}
                    disabled={isPlanning || !selectedDate}
                  >
                    {isPlanning ? 'Planification...' : 'Planifier ✦'}
                  </button>
                  <button
                    type="button"
                    className={styles.passBtn}
                    onClick={() => { void handlePass(); }}
                    disabled={isPassing}
                  >
                    {isPassing ? '...' : 'Passer →'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.taskInputArea}>
        <TaskInput onTaskCreated={onTaskCreated} isDesktop />
      </div>
    </div>
  );
}
