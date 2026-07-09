import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LightningIcon, SparkleIcon, StarIcon, XIcon } from '@phosphor-icons/react';
import { useTheme } from '../context/ThemeContext.js';
import { useTags } from '../hooks/useTags.js';
import { TagSelector } from './TagSelector.js';
import type { Task, Whisper } from '../types/index.js';
import styles from './WhisperTriage.module.css';

interface WhisperTriageProps {
  open: boolean;
  onClose: () => void;
  whispers: Whisper[];
  reveal: (id: string, input: { urgent: boolean; important: boolean; tagIds?: string[] }) => Promise<Task>;
  dismiss: (id: string) => Promise<void>;
}

interface TriageState {
  urgent: boolean;
  important: boolean;
  tagIds: string[];
}

const DEFAULT_STATE: TriageState = { urgent: false, important: false, tagIds: [] };

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Tri différé des murmures — chaque murmure devient une vision seulement une
 * fois classé ici (ou dans le futur Rituel de l'Aube, v3-03). Rien n'est
 * envoyé à MatrixView tant que ce n'est pas fait.
 */
export function WhisperTriage({ open, onClose, whispers, reveal, dismiss }: WhisperTriageProps) {
  const { t } = useTheme();
  const { tags } = useTags();
  const [states, setStates] = useState<Record<string, TriageState>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, [open, onClose]);

  if (!open) return null;

  const getState = (id: string): TriageState => states[id] ?? DEFAULT_STATE;

  const setState = (id: string, patch: Partial<TriageState>) => {
    setStates((prev) => ({ ...prev, [id]: { ...getState(id), ...patch } }));
  };

  const handleReveal = async (whisper: Whisper) => {
    if (pendingId !== null) return;
    const state = getState(whisper.id);
    setPendingId(whisper.id);
    try {
      await reveal(whisper.id, {
        urgent: state.urgent,
        important: state.important,
        ...(state.tagIds.length > 0 ? { tagIds: state.tagIds } : {}),
      });
    } catch {
      // reveal() a déjà annulé son optimistic update — le murmure réapparaît dans la liste
    } finally {
      setPendingId(null);
    }
  };

  const handleDismiss = async (whisper: Whisper) => {
    if (pendingId !== null) return;
    setPendingId(whisper.id);
    try {
      await dismiss(whisper.id);
    } catch {
      // dismiss() a déjà annulé son optimistic update
    } finally {
      setPendingId(null);
    }
  };

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('quickNote')}>
      <div className={styles.box}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
          <XIcon size={18} weight="bold" />
        </button>
        <h2 className={styles.title}>{capitalize(t('quickNote'))} ({whispers.length.toString()})</h2>

        {whispers.length === 0 ? (
          <p className={styles.empty}>Rien en suspens pour l'instant.</p>
        ) : (
          <ul className={styles.list}>
            {whispers.map((whisper) => {
              const state = getState(whisper.id);
              const isPending = pendingId === whisper.id;
              return (
                <li key={whisper.id} className={styles.item}>
                  <p className={styles.text}>{whisper.text}</p>
                  <div className={styles.toggles}>
                    <button
                      type="button"
                      className={[styles.toggle, state.urgent ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
                      onClick={() => { setState(whisper.id, { urgent: !state.urgent }); }}
                      aria-pressed={state.urgent}
                    >
                      <LightningIcon size={14} weight={state.urgent ? 'duotone' : 'regular'} />
                      Urgent
                    </button>
                    <button
                      type="button"
                      className={[styles.toggle, state.important ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
                      onClick={() => { setState(whisper.id, { important: !state.important }); }}
                      aria-pressed={state.important}
                    >
                      <StarIcon size={14} weight={state.important ? 'duotone' : 'regular'} />
                      Important
                    </button>
                  </div>
                  {tags.length > 0 && (
                    <TagSelector
                      tags={tags}
                      selectedIds={state.tagIds}
                      onChange={(ids) => { setState(whisper.id, { tagIds: ids }); }}
                    />
                  )}
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.revealBtn}
                      disabled={isPending}
                      onClick={() => { void handleReveal(whisper); }}
                    >
                      <SparkleIcon size={16} weight="duotone" />
                      {t('addAction')} ✦
                    </button>
                    <button
                      type="button"
                      className={styles.dismissBtn}
                      disabled={isPending}
                      onClick={() => { void handleDismiss(whisper); }}
                    >
                      {t('whisperDismiss')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
