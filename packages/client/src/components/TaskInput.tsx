import { type KeyboardEvent, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useTags } from '../hooks/useTags.js';
import type { Task } from '../types/index.js';
import styles from './TaskInput.module.css';

interface TaskInputProps {
  onTaskCreated: () => void;
  isDesktop?: boolean;
}

export function TaskInput({ onTaskCreated, isDesktop = false }: TaskInputProps) {
  const tags = useTags();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setTitle('');
    setPanelOpen(false);
    setUrgent(false);
    setImportant(false);
    setSelectedTagIds([]);
    setTimeout(() => { inputRef.current?.focus(); }, 0);
  };

  const createTask = async (u: boolean, i: boolean, tIds: string[]) => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post<Task>('/tasks', {
        title: title.trim(),
        urgent: u,
        important: i,
        tagIds: tIds.length > 0 ? tIds : undefined,
      });
      onTaskCreated();
      reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && title.trim()) {
      if (panelOpen) {
        void createTask(urgent, important, selectedTagIds);
      } else {
        // Raccourci : Enter direct → La Brume
        void createTask(false, false, []);
      }
    }
    if (e.key === 'Escape') {
      setPanelOpen(false);
    }
  };

  const openPanel = () => {
    if (title.trim()) setPanelOpen(true);
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  return (
    <div className={isDesktop ? styles.desktopWrapper : styles.mobileWrapper}>
      {/* Panel options */}
      {panelOpen && (
        <div className={[styles.panel, isDesktop ? styles.panelDesktop : styles.panelMobile].filter(Boolean).join(' ')}>
          <div className={styles.toggleRow}>
            <button
              type="button"
              className={[styles.toggle, urgent ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
              onClick={() => { setUrgent((v) => !v); }}
            >
              ⚡ Urgent
            </button>
            <button
              type="button"
              className={[styles.toggle, important ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
              onClick={() => { setImportant((v) => !v); }}
            >
              ⭐ Important
            </button>
          </div>

          {tags.length > 0 && (
            <div className={styles.tagRow}>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={[styles.tagChip, selectedTagIds.includes(tag.id) ? styles.tagChipActive : undefined].filter(Boolean).join(' ')}
                  onClick={() => { toggleTag(tag.id); }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className={styles.revealBtn}
            disabled={!title.trim() || isSubmitting}
            onClick={() => { void createTask(urgent, important, selectedTagIds); }}
          >
            {isSubmitting ? 'Révélation…' : '✦ Révéler'}
          </button>
        </div>
      )}

      {/* Barre de saisie */}
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder="Nouvelle vision..."
          value={title}
          onChange={(e) => { setTitle(e.target.value); }}
          onKeyDown={handleKeyDown}
          aria-label="Nouvelle vision"
        />
        <button
          type="button"
          className={styles.optionsBtn}
          disabled={!title.trim()}
          onClick={openPanel}
          aria-label="Options"
          title="Options (Urgent / Important / Tags)"
        >
          ✦ Révéler
        </button>
      </div>
    </div>
  );
}
