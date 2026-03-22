import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import type { Task } from '../types/index.js';
import { formatRelativeDate } from '../utils/dates.js';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
  onComplete: (id: string) => Promise<void>;
  onEliminate: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Pick<Task, 'urgent' | 'important'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskCard({ task, onComplete, onEliminate, onUpdate, onDelete }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMist = task.quadrant === 'MIST';

  const handleCircleClick = () => {
    if (isMist) {
      void onEliminate(task.id);
    } else {
      void onComplete(task.id);
    }
  };

  const openMenu = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    setMenuOpen(true);
    setConfirmDelete(false);
  };

  const handleContextMenu = (e: MouseEvent) => {
    openMenu(e);
  };

  const handleTouchStart = (e: TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      openMenu(e);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [menuOpen]);

  const quadrantColorVar = `var(--quadrant-${task.quadrant.toLowerCase()})`;

  return (
    <div
      className={[styles.card, isMist ? styles.mist : undefined].filter(Boolean).join(' ')}
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
          aria-label={isMist ? 'Éliminer' : 'Compléter'}
        />
        <div className={styles.content}>
          <span className={styles.title}>{task.title}</span>
          {task.tags.length > 0 && (
            <div className={styles.tags}>
              {task.tags.map((tag) => (
                <span key={tag.id} className={styles.tag}>{tag.name}</span>
              ))}
            </div>
          )}
        </div>
        <span className={styles.date}>{formatRelativeDate(task.createdAt)}</span>
      </div>

      {menuOpen && (
        <div className={styles.menu} ref={menuRef}>
          {!task.urgent && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                void onUpdate(task.id, { urgent: true });
                setMenuOpen(false);
              }}
            >
              ⚡ Rendre urgent
            </button>
          )}
          {task.urgent && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                void onUpdate(task.id, { urgent: false });
                setMenuOpen(false);
              }}
            >
              ⚡ Retirer l'urgence
            </button>
          )}
          {!task.important && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                void onUpdate(task.id, { important: true });
                setMenuOpen(false);
              }}
            >
              ✦ Rendre important
            </button>
          )}
          {task.important && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                void onUpdate(task.id, { important: false });
                setMenuOpen(false);
              }}
            >
              ✦ Retirer l'importance
            </button>
          )}
          <div className={styles.menuDivider} />
          {!confirmDelete ? (
            <button
              type="button"
              className={[styles.menuItem, styles.menuItemDanger].join(' ')}
              onClick={() => { setConfirmDelete(true); }}
            >
              🗑 Supprimer
            </button>
          ) : (
            <button
              type="button"
              className={[styles.menuItem, styles.menuItemDanger].join(' ')}
              onClick={() => {
                void onDelete(task.id);
                setMenuOpen(false);
              }}
            >
              Confirmer la suppression
            </button>
          )}
        </div>
      )}
    </div>
  );
}
