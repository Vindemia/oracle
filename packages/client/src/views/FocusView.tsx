import { type ChangeEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { Tag, Task } from '../types/index.js';
import { CalendarButton, buildGoogleCalUrl, downloadIcal } from '../components/CalendarButton.js';
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
  onComplete: (id: string) => Promise<void>;
  onPassFire: (id: string) => Promise<void>;
}

export function FocusView({ tasks, isLoading, allTags: _allTags, onPlan, onPass, onComplete, onPassFire }: FocusViewProps) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(getDefaultDatetime());
  const [plannedTask, setPlannedTask] = useState<Task | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isPassing, setIsPassing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isPassingFire, setIsPassingFire] = useState(false);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const unplannedStars = tasks
    .filter((t) => t.quadrant === 'STARS' && t.status === 'ACTIVE' && t.plannedFor === null)
    .sort((a, b) => a.position - b.position);

  const fireTasks = tasks
    .filter((t) => t.quadrant === 'FIRE' && t.status === 'ACTIVE')
    .sort((a, b) => a.position - b.position);

  const phase: 'planning' | 'action' | 'done' =
    unplannedStars.length > 0 ? 'planning'
    : fireTasks.length > 0 ? 'action'
    : 'done';

  const handlePlan = async () => {
    if (!unplannedStars[0] || isPlanning) return;
    const currentTask = unplannedStars[0];
    setIsPlanning(true);
    try {
      const isoDate = new Date(selectedDate).toISOString();
      await onPlan(currentTask.id, isoDate);
      setPlannedTask({ ...currentTask, plannedFor: isoDate });
      setSelectedDate(getDefaultDatetime());
      setShowCalendarModal(true);
    } finally {
      setIsPlanning(false);
    }
  };

  const handlePass = async () => {
    if (!unplannedStars[0] || isPassing) return;
    setIsPassing(true);
    try {
      await onPass(unplannedStars[0].id);
    } finally {
      setIsPassing(false);
    }
  };

  const handleComplete = async () => {
    if (!fireTasks[0] || isCompleting) return;
    setIsCompleting(true);
    setShowSuccessFlash(true);
    try {
      await onComplete(fireTasks[0].id);
    } finally {
      setIsCompleting(false);
      setTimeout(() => {
        setShowSuccessFlash(false);
      }, 600);
    }
  };

  const dismissCalendarModal = () => {
    setShowCalendarModal(false);
    setPlannedTask(null);
  };

  const handlePassFire = async () => {
    if (!fireTasks[0] || isPassingFire) return;
    setIsPassingFire(true);
    try {
      await onPassFire(fireTasks[0].id);
    } finally {
      setIsPassingFire(false);
    }
  };

  /* ── Modal agenda (rendu indépendamment de la phase) ── */
  const calendarModal = showCalendarModal && plannedTask !== null
    ? createPortal(
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            <p className={styles.modalConfirm}>Vision planifiée ✓</p>
            <h2 className={styles.modalTitle}>L'ajouter à votre agenda ?</h2>
            <div className={styles.modalActions}>
              <a
                href={buildGoogleCalUrl(plannedTask)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.modalBtnPrimary}
                onClick={dismissCalendarModal}
              >
                Google Agenda
              </a>
              <button
                type="button"
                className={styles.modalBtnSecondary}
                onClick={() => { downloadIcal(plannedTask); dismissCalendarModal(); }}
              >
                Télécharger .ics
              </button>
              <button
                type="button"
                className={styles.modalBtnGhost}
                onClick={dismissCalendarModal}
              >
                Non, passer →
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Consultation des étoiles...</div>
      </div>
    );
  }

  /* ── Phase done ── */
  if (phase === 'done') {
    return (
      <>
        <div className={styles.container}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🌟</div>
            <h2 className={styles.emptyTitle}>Le feu est maîtrisé 🌟</h2>
            <p className={styles.emptySubtitle}>Vos priorités sont maîtrisées.</p>
            <button
              type="button"
              className={styles.matrixBtn}
              onClick={() => { void navigate('/'); }}
            >
              Retour à la matrice
            </button>
          </div>
        </div>
        {calendarModal}
      </>
    );
  }

  /* ── Phase action (FIRE) ── */
  if (phase === 'action') {
    const currentFire = fireTasks[0];
    if (!currentFire) return null;
    return (
      <>
        <div className={styles.container}>
          <div className={styles.card}>
            {/* En-tête */}
            <div className={styles.header}>
              <span className={[styles.urgenceBadge, styles.pulseAnim].filter(Boolean).join(' ')}>
                ⚡ Les Urgences
              </span>
              <span className={styles.counter}>
                {fireTasks.length.toString() + ' urgence' + (fireTasks.length > 1 ? 's' : '')}
              </span>
            </div>

            {/* Carte vision */}
            <div className={[styles.taskCard, styles.fireCard, showSuccessFlash ? styles.successFlash : undefined].filter(Boolean).join(' ')}>
              <h1 className={styles.taskTitle}>{currentFire.title}</h1>

              {/* Tags */}
              {currentFire.tags.length > 0 && (
                <div className={styles.tagsRow}>
                  {currentFire.tags.map((tag) => (
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

              {/* CalendarButton si planifiée */}
              {currentFire.plannedFor !== null && (
                <div className={styles.calendarRow}>
                  <CalendarButton task={currentFire} />
                </div>
              )}

              {/* Actions */}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.completeBtn}
                  onClick={() => { void handleComplete(); }}
                  disabled={isCompleting}
                >
                  {isCompleting ? 'Traitement...' : "C'est fait ✓"}
                </button>
                <button
                  type="button"
                  className={styles.passBtn}
                  onClick={() => { void handlePassFire(); }}
                  disabled={isPassingFire}
                >
                  {isPassingFire ? '...' : 'Passer →'}
                </button>
              </div>
            </div>
          </div>
        </div>
        {calendarModal}
      </>
    );
  }

  /* ── Phase planning (STARS) ── */
  const currentTask = unplannedStars[0] ?? null;

  return (
    <>
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
          {currentTask !== null && (
            <div className={styles.taskCard}>
              <h1 className={styles.taskTitle}>{currentTask.title}</h1>

              {/* Tags */}
              {currentTask.tags.length > 0 && (
                <div className={styles.tagsRow}>
                  {currentTask.tags.map((tag) => (
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
            </div>
          )}
        </div>
      </div>
      {calendarModal}
    </>
  );
}
