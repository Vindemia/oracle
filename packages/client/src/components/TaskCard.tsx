import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent, TouchEvent } from 'react';
import type { Tag, Task } from '../types/index.js';
import { formatRelativeDate, isStarredToday } from '../utils/dates.js';
import { hexToRgba } from '../utils/colors.js';
import { TagSelector } from './TagSelector.js';
import { buildGoogleCalUrl, downloadIcal } from './CalendarButton.js';
import { useTheme } from '../context/ThemeContext.js';
import { useToast } from '../context/ToastContext.js';
import { getCompleteToast, getEliminateToast } from '../utils/animations.js';
import styles from './TaskCard.module.css';

// Annulation (v3-17) : fenêtre de rattrapage immédiate après un complete/eliminate.
const UNDO_TOAST_DURATION_MS = 6000;

interface TaskCardProps {
  task: Task;
  allTags: Tag[];
  onComplete: (id: string) => Promise<void>;
  onEliminate: (id: string) => Promise<void>;
  onReactivate: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Pick<Task, 'urgent' | 'important'>>) => Promise<void>;
  onUpdateTags: (id: string, newTags: Tag[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddStep: (id: string, title: string) => Promise<void>;
  onToggleStep: (id: string, stepId: string) => Promise<void>;
  onRemoveStep: (id: string, stepId: string) => Promise<void>;
  onUnplan?: (id: string) => Promise<void>;
  onPlan?: (id: string, date: string) => Promise<void>;
}

const MENU_HEIGHT_EST = 170;

const plannedFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function defaultDatetimeLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T09:00';
}

export function TaskCard({ task, allTags, onComplete, onEliminate, onReactivate, onUpdate, onUpdateTags, onDelete, onAddStep, onToggleStep, onRemoveStep, onUnplan, onPlan }: TaskCardProps) {
  const { t } = useTheme();
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState('');

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalStep, setPlanModalStep] = useState<'pick' | 'calendar'>('pick');
  const [planModalDate, setPlanModalDate] = useState('');
  const [planModalSaved, setPlanModalSaved] = useState<Task | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tagBtnRef = useRef<HTMLButtonElement>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMist = task.quadrant === 'MIST';

  const handleTagBtnClick = () => {
    if (tagPopoverOpen) {
      setTagPopoverOpen(false);
      return;
    }
    if (tagBtnRef.current) {
      const rect = tagBtnRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setMenuOpen(false);
    setTagPopoverOpen(true);
  };

  const handleTagsChange = (ids: string[]) => {
    const newTags = allTags.filter((t) => ids.includes(t.id));
    void onUpdateTags(task.id, newTags);
  };

  // Annulation (v3-17) : toast « Annuler » quelques secondes après l'action —
  // le filet permanent (Historique) reste disponible ensuite sans limite de temps.
  const handleCircleClick = () => {
    void (async () => {
      try {
        if (isMist) {
          await onEliminate(task.id);
          const { message, variant } = getEliminateToast();
          showToast(message, variant, {
            durationMs: UNDO_TOAST_DURATION_MS,
            action: { label: 'Annuler', onClick: () => { void onReactivate(task.id); } },
          });
        } else {
          await onComplete(task.id);
          // ponytail: isFirstOfDay/allDone toujours false ici — nécessiteraient
          // de connaître les autres tâches accomplies du jour, hors scope v3-17.
          const { message, variant } = getCompleteToast(task.quadrant, false, false);
          showToast(message, variant, {
            durationMs: UNDO_TOAST_DURATION_MS,
            action: { label: 'Annuler', onClick: () => { void onReactivate(task.id); } },
          });
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Une erreur est survenue, réessaie', 'error');
      }
    })();
  };

  // Fragments (v3-01) — toujours mettre en avant le prochain non fait, jamais le premier tout court
  const nextStep = task.steps.find((s) => !s.done);
  const doneStepsCount = task.steps.filter((s) => s.done).length;

  const handleAddStep = async () => {
    const title = newStepTitle.trim();
    if (!title) return;
    setNewStepTitle('');
    try {
      await onAddStep(task.id, title);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Une erreur est survenue, réessaie', 'error');
    }
  };

  const openMenu = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < MENU_HEIGHT_EST + 8
        ? Math.max(4, rect.top - MENU_HEIGHT_EST - 4)
        : rect.bottom + 4;
      setMenuPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setMenuOpen(true);
    setConfirmDelete(false);
  };

  const handleContextMenu = (e: MouseEvent) => { openMenu(e); };
  const handleTouchStart = (e: TouchEvent) => {
    longPressTimer.current = setTimeout(() => { openMenu(e); }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openPlanModal = (e: MouseEvent) => {
    e.stopPropagation();
    setPlanModalDate(task.plannedFor ? toDatetimeLocalValue(task.plannedFor) : defaultDatetimeLocal());
    setPlanModalStep('pick');
    setPlanModalSaved(null);
    setPlanModalOpen(true);
  };

  const handleSavePlan = async () => {
    if (!onPlan || !planModalDate || isSavingPlan) return;
    setIsSavingPlan(true);
    try {
      const isoDate = new Date(planModalDate).toISOString();
      await onPlan(task.id, isoDate);
      setPlanModalSaved({ ...task, plannedFor: isoDate });
      setPlanModalStep('calendar');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const closePlanModal = () => {
    setPlanModalOpen(false);
    setPlanModalSaved(null);
    setPlanModalStep('pick');
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!tagPopoverOpen) return;
    const handler = (e: Event) => {
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(e.target as Node)) setTagPopoverOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [tagPopoverOpen]);

  useEffect(() => {
    if (!planModalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePlanModal(); };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, [planModalOpen]);

  const quadrantColorVar = `var(--quadrant-${task.quadrant.toLowerCase()})`;

  return (
    <div
      ref={cardRef}
      className={[
        styles.card,
        isMist ? styles.mist : undefined,
        isStarredToday(task) ? styles.starred : undefined,
      ].filter(Boolean).join(' ')}
      style={{ borderLeftColor: quadrantColorVar }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.cardRow}>
        <button
          type="button"
          className={styles.circle}
          style={{ borderColor: quadrantColorVar }}
          onClick={handleCircleClick}
          aria-label={isMist ? t('eliminateAction') : 'Compléter'}
        />
        <div className={styles.content}>
          <span className={styles.title}>{task.title}</span>

          {/* Fragments (v3-01) — prochain non fait + compteur ; clic sur la ligne (hors puce) déplie l'éditeur */}
          {task.steps.length > 0 && (
            <div className={styles.stepsRow} onClick={() => { setStepsExpanded((v) => !v); }}>
              {nextStep !== undefined && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={nextStep.done}
                  aria-label={t('step') + ' : ' + nextStep.title}
                  className={[styles.stepBullet, nextStep.done ? styles.stepBulletChecked : undefined].filter(Boolean).join(' ')}
                  onClick={(e) => { e.stopPropagation(); void onToggleStep(task.id, nextStep.id); }}
                >
                  ◈
                </button>
              )}
              {nextStep !== undefined && (
                <span className={styles.stepTitle}>{nextStep.title}</span>
              )}
              <span className={styles.stepCounter}>{doneStepsCount}/{task.steps.length}</span>
            </div>
          )}

          {stepsExpanded && (
            <div className={styles.stepsList} onClick={(e) => { e.stopPropagation(); }}>
              {task.steps.map((step) => (
                <div key={step.id} className={styles.stepItem}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={step.done}
                    aria-label={t('step') + ' : ' + step.title}
                    className={[styles.stepItemCheck, step.done ? styles.stepBulletChecked : undefined].filter(Boolean).join(' ')}
                    onClick={() => { void onToggleStep(task.id, step.id); }}
                  >
                    {step.done ? '✓' : '◈'}
                  </button>
                  <span className={[styles.stepItemTitle, step.done ? styles.stepItemDone : undefined].filter(Boolean).join(' ')}>
                    {step.title}
                  </span>
                  <button
                    type="button"
                    className={styles.stepItemRemove}
                    aria-label={'Supprimer ' + t('step') + ' : ' + step.title}
                    onClick={() => { void onRemoveStep(task.id, step.id); }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {task.steps.length < 10 && (
                <input
                  type="text"
                  className={styles.stepAddInput}
                  placeholder={t('newStepPlaceholder')}
                  value={newStepTitle}
                  onChange={(e) => { setNewStepTitle(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { void handleAddStep(); } }}
                  aria-label={t('newStepPlaceholder')}
                />
              )}
            </div>
          )}

          {/* Date de planification — juste sous le titre */}
          {task.plannedFor !== null && (
            <div className={styles.plannedBadge}>
              <button
                type="button"
                className={styles.plannedBadgeText}
                onClick={openPlanModal}
                title="Modifier la planification"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {plannedFormatter.format(new Date(task.plannedFor))}
              </button>
              {onUnplan !== undefined && (
                <button
                  type="button"
                  className={styles.plannedBadgeRemove}
                  onClick={(e: MouseEvent) => { e.stopPropagation(); void onUnplan(task.id); }}
                  title="Supprimer la planification"
                  aria-label="Supprimer la planification"
                >
                  ×
                </button>
              )}
            </div>
          )}

          {/* Tags */}
          {task.tags.length > 0 && (
            <div className={styles.tags}>
              {task.tags.map((tag) => (
                <span
                  key={tag.id}
                  className={styles.tag}
                  style={{
                    color: tag.color,
                    backgroundColor: hexToRgba(tag.color, 0.12),
                  }}
                >
                  {tag.icon} {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <span className={styles.date}>{formatRelativeDate(task.createdAt)}</span>
          {/* Bouton planifier — uniquement si pas encore planifié */}
          {task.plannedFor === null && onPlan !== undefined && (
            <button
              type="button"
              className={styles.planBtn}
              onClick={openPlanModal}
              aria-label="Planifier"
              title="Planifier"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {allTags.length > 0 && (
            <button
              ref={tagBtnRef}
              type="button"
              className={styles.tagBtn}
              onMouseDown={(e) => { e.stopPropagation(); }}
              onClick={handleTagBtnClick}
              aria-label="Modifier les tags"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0L2.293 8.707A1 1 0 0 1 2 8V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="5.5" cy="5.5" r="1" fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {tagPopoverOpen && createPortal(
        <div
          className={styles.tagPopover}
          ref={tagPopoverRef}
          style={{ top: popoverPos.top, right: popoverPos.right }}
        >
          <TagSelector
            tags={allTags}
            selectedIds={task.tags.map((t) => t.id)}
            onChange={handleTagsChange}
          />
        </div>,
        document.body,
      )}

      {menuOpen && createPortal(
        <div
          className={styles.menu}
          ref={menuRef}
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          <button type="button" className={styles.menuItem} onClick={() => { setStepsExpanded(true); setMenuOpen(false); }}>
            ◈ {t('step').charAt(0).toUpperCase() + t('step').slice(1)}s
          </button>
          <div className={styles.menuDivider} />
          {!task.urgent && (
            <button type="button" className={styles.menuItem} onClick={() => { void onUpdate(task.id, { urgent: true }); setMenuOpen(false); }}>
              ⚡ Rendre urgent
            </button>
          )}
          {task.urgent && (
            <button type="button" className={styles.menuItem} onClick={() => { void onUpdate(task.id, { urgent: false }); setMenuOpen(false); }}>
              ⚡ Retirer l'urgence
            </button>
          )}
          {!task.important && (
            <button type="button" className={styles.menuItem} onClick={() => { void onUpdate(task.id, { important: true }); setMenuOpen(false); }}>
              ✦ Rendre important
            </button>
          )}
          {task.important && (
            <button type="button" className={styles.menuItem} onClick={() => { void onUpdate(task.id, { important: false }); setMenuOpen(false); }}>
              ✦ Retirer l'importance
            </button>
          )}
          <div className={styles.menuDivider} />
          {!confirmDelete ? (
            <button type="button" className={[styles.menuItem, styles.menuItemDanger].join(' ')} onClick={() => { setConfirmDelete(true); }}>
              🗑 Supprimer
            </button>
          ) : (
            <button type="button" className={[styles.menuItem, styles.menuItemDanger].join(' ')} onClick={() => { void onDelete(task.id); setMenuOpen(false); }}>
              Confirmer la suppression
            </button>
          )}
        </div>,
        document.body,
      )}

      {planModalOpen && createPortal(
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            {planModalStep === 'pick' ? (
              <>
                <h2 className={styles.modalTitle}>
                  {task.plannedFor !== null ? 'Modifier la planification' : 'Planifier cette vision'}
                </h2>
                <div className={styles.modalDateRow}>
                  <label htmlFor={'plan-date-' + task.id} className={styles.modalDateLabel}>
                    Date et heure
                  </label>
                  <input
                    id={'plan-date-' + task.id}
                    type="datetime-local"
                    className={styles.modalDateInput}
                    value={planModalDate}
                    onChange={(e) => { setPlanModalDate(e.target.value); }}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalBtnPrimary}
                    onClick={() => { void handleSavePlan(); }}
                    disabled={isSavingPlan || !planModalDate}
                  >
                    {isSavingPlan ? 'Planification...' : 'Planifier ✦'}
                  </button>
                  <button type="button" className={styles.modalBtnGhost} onClick={closePlanModal}>
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.modalConfirm}>Vision planifiée ✓</p>
                <h2 className={styles.modalTitle}>L'ajouter à votre agenda ?</h2>
                <div className={styles.modalActions}>
                  {planModalSaved !== null && (
                    <>
                      <a
                        href={buildGoogleCalUrl(planModalSaved)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.modalBtnPrimary}
                        onClick={closePlanModal}
                      >
                        Google Agenda
                      </a>
                      <button
                        type="button"
                        className={styles.modalBtnSecondary}
                        onClick={() => { downloadIcal(planModalSaved); closePlanModal(); }}
                      >
                        Télécharger .ics
                      </button>
                    </>
                  )}
                  <button type="button" className={styles.modalBtnGhost} onClick={closePlanModal}>
                    Non, fermer →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
