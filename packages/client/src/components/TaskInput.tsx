import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useTags } from '../hooks/useTags.js';
import { TagSelector } from './TagSelector.js';
import type { Task } from '../types/index.js';
import styles from './TaskInput.module.css';

interface TaskInputProps {
  onTaskCreated: () => void;
  isDesktop?: boolean;
}

export function TaskInput({ onTaskCreated, isDesktop = false }: TaskInputProps) {
  const { tags } = useTags();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!tagPanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setTagPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [tagPanelOpen]);

  const reset = () => {
    setTitle('');
    setTagPanelOpen(false);
    setUrgent(false);
    setImportant(false);
    setSelectedTagIds([]);
    setTimeout(() => { inputRef.current?.focus(); }, 0);
  };

  const createTask = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.post<Task>('/tasks', {
        title: title.trim(),
        urgent,
        important,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });
      onTaskCreated();
      reset();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Une erreur est survenue, réessaie');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && title.trim()) {
      void createTask();
    }
    if (e.key === 'Escape') {
      setTagPanelOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={isDesktop ? styles.desktopWrapper : styles.mobileWrapper}>
      {/* Volet tags */}
      {tagPanelOpen && tags.length > 0 && (
        <div className={[styles.tagPanel, isDesktop ? styles.tagPanelDesktop : ''].filter(Boolean).join(' ')}>
          <TagSelector
            tags={tags}
            selectedIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        </div>
      )}

      {/* Erreur de soumission */}
      {submitError !== null && (
        <div className={styles.errorBanner} role="alert">
          {submitError}
        </div>
      )}

      {/* Barre de saisie */}
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          type="text"
          data-task-input="true"
          className={styles.input}
          placeholder="Nouvelle vision..."
          value={title}
          onChange={(e) => { setTitle(e.target.value); }}
          onKeyDown={handleKeyDown}
          aria-label="Nouvelle vision"
        />
        <button
          type="button"
          className={[styles.toggle, urgent ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
          onClick={() => { setUrgent((v) => !v); }}
          title="Urgent"
          aria-label="Urgent"
          aria-pressed={urgent}
        >
          ⚡ Urgent
        </button>
        <button
          type="button"
          className={[styles.toggle, important ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
          onClick={() => { setImportant((v) => !v); }}
          title="Important"
          aria-label="Important"
          aria-pressed={important}
        >
          ⭐ Important
        </button>
        {tags.length > 0 && (
          <button
            type="button"
            className={[styles.tagBtn, (tagPanelOpen || selectedTagIds.length > 0) ? styles.tagBtnActive : undefined].filter(Boolean).join(' ')}
            onClick={() => { setTagPanelOpen((v) => !v); }}
            title="Tags"
            aria-label="Choisir des tags"
            aria-pressed={tagPanelOpen}
          >
            {selectedTagIds.length > 0
              ? <span className={styles.tagCount}>{selectedTagIds.length}</span>
              : '🔖'}
          </button>
        )}
        <button
          type="button"
          className={styles.submitBtn}
          disabled={!title.trim() || isSubmitting}
          onClick={() => { void createTask(); }}
          aria-label="Révéler la vision"
          title="Révéler (Entrée)"
        >
          {isSubmitting ? '…' : '✓'}
        </button>
      </div>
    </div>
  );
}
