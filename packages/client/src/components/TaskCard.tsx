import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DragEvent, MouseEvent, TouchEvent } from 'react';
import type { Tag, Task } from '../types/index.js';
import { formatRelativeDate } from '../utils/dates.js';
import { hexToRgba } from '../utils/colors.js';
import { TagSelector } from './TagSelector.js';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
  allTags: Tag[];
  onComplete: (id: string) => Promise<void>;
  onEliminate: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Pick<Task, 'urgent' | 'important'>>) => Promise<void>;
  onUpdateTags: (id: string, newTags: Tag[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskCard({ task, allTags, onComplete, onEliminate, onUpdate, onUpdateTags, onDelete }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const tagBtnRef = useRef<HTMLButtonElement>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMist = task.quadrant === 'MIST';

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDragEnd = () => { setIsDragging(false); };

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

  useEffect(() => {
    if (!tagPopoverOpen) return;
    const handler = (e: Event) => {
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(e.target as Node)) {
        setTagPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [tagPopoverOpen]);

  const quadrantColorVar = `var(--quadrant-${task.quadrant.toLowerCase()})`;

  return (
    <div
      className={[styles.card, isMist ? styles.mist : undefined, isDragging ? styles.dragging : undefined].filter(Boolean).join(' ')}
      style={{ borderLeftColor: quadrantColorVar }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
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
