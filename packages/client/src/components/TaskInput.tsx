import { LightningIcon, StarIcon, TagIcon, SparkleIcon, CircleNotchIcon } from '@phosphor-icons/react';
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

  // Visual Viewport API : compense la barre d'UI dynamique des navigateurs mobiles.
  // - bottom positioning (pas top) : vv.offsetTop inclut le scroll sur Chrome,
  //   ce qui casserait le positionnement si on utilisait top.
  // - requestAnimationFrame : évite la race condition Firefox où window.innerHeight
  //   et vv.height se mettent à jour dans des events distincts.
  // - ResizeObserver sur l'élément : met à jour --mobile-bar-height quand la
  //   toolbar apparaît/disparaît, pour que le contenu ne passe pas sous la barre.
  useEffect(() => {
    if (isDesktop || !window.visualViewport) return;
    const vv = window.visualViewport;
    const el = wrapperRef.current;
    if (!el) return;

    let rafId: number;
    const update = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        el.style.bottom = offset.toString() + 'px';
        document.documentElement.style.setProperty(
          '--mobile-bar-height',
          (el.offsetHeight + offset).toString() + 'px',
        );
      });
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    update();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      el.style.bottom = '';
      document.documentElement.style.removeProperty('--mobile-bar-height');
    };
  }, [isDesktop]);

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

  /* Boutons Urgent / Important / Tags — partagés entre les deux layouts */
  const toggleButtons = (
    <>
      <button
        type="button"
        className={[styles.toggle, urgent ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
        onClick={() => { setUrgent((v) => !v); }}
        title="Urgent"
        aria-label="Urgent"
        aria-pressed={urgent}
      >
        <LightningIcon size={16} weight={urgent ? 'duotone' : 'regular'} />
        Urgent
      </button>
      <button
        type="button"
        className={[styles.toggle, important ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
        onClick={() => { setImportant((v) => !v); }}
        title="Important"
        aria-label="Important"
        aria-pressed={important}
      >
        <StarIcon size={16} weight={important ? 'duotone' : 'regular'} />
        Important
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
            : <TagIcon size={18} weight="regular" />}
        </button>
      )}
    </>
  );

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

      {/* Mobile : toolbar contextuelle (glisse quand on écrit) */}
      {!isDesktop && title.length > 0 && (
        <div className={styles.toolbarRow}>
          {toggleButtons}
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
        {/* Desktop : boutons inline */}
        {isDesktop && toggleButtons}
        <button
          type="button"
          className={styles.submitBtn}
          disabled={!title.trim() || isSubmitting}
          onClick={() => { void createTask(); }}
          aria-label="Révéler la vision"
          title="Révéler (Entrée)"
        >
          {isSubmitting
            ? <CircleNotchIcon size={20} weight="bold" className={styles.spinner} />
            : <SparkleIcon size={20} weight="duotone" />}
        </button>
      </div>
    </div>
  );
}
