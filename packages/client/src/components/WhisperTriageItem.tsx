import { useState } from 'react';
import { LightningIcon, SparkleIcon, StarIcon } from '@phosphor-icons/react';
import { useTheme } from '../context/ThemeContext.js';
import { useTags } from '../hooks/useTags.js';
import { TagSelector } from './TagSelector.js';
import type { Whisper } from '../types/index.js';
import styles from './WhisperTriage.module.css';

export interface RevealInput {
  urgent: boolean;
  important: boolean;
  tagIds?: string[];
}

interface WhisperTriageItemProps {
  whisper: Whisper;
  onReveal: (input: RevealInput) => Promise<void>;
  onDismiss: () => Promise<void>;
  /** Verrouille les actions pendant qu'un autre murmure est en cours de traitement. */
  disabled?: boolean;
}

/**
 * Un murmure en cours de tri : les deux axes d'Eisenhower, les étiquettes,
 * puis « révéler » ou « rendre à la brume ». Partagé par la liste de tri du
 * header (v3-02) et l'étape 1 du Rituel de l'Aube (v3-03) — le conteneur
 * (`<li>`, plein écran…) appartient à l'appelant.
 */
export function WhisperTriageItem({ whisper, onReveal, onDismiss, disabled = false }: WhisperTriageItemProps) {
  const { t } = useTheme();
  const { tags } = useTags();
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);

  return (
    <>
      <p className={styles.text}>{whisper.text}</p>
      <div className={styles.toggles}>
        <button
          type="button"
          className={[styles.toggle, urgent ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
          onClick={() => { setUrgent((v) => !v); }}
          aria-pressed={urgent}
        >
          <LightningIcon size={14} weight={urgent ? 'duotone' : 'regular'} />
          Urgent
        </button>
        <button
          type="button"
          className={[styles.toggle, important ? styles.toggleActive : undefined].filter(Boolean).join(' ')}
          onClick={() => { setImportant((v) => !v); }}
          aria-pressed={important}
        >
          <StarIcon size={14} weight={important ? 'duotone' : 'regular'} />
          Important
        </button>
      </div>
      {tags.length > 0 && (
        <TagSelector tags={tags} selectedIds={tagIds} onChange={setTagIds} />
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.revealBtn}
          disabled={disabled}
          onClick={() => {
            void onReveal({ urgent, important, ...(tagIds.length > 0 ? { tagIds } : {}) });
          }}
        >
          <SparkleIcon size={16} weight="duotone" />
          {t('addAction')} ✦
        </button>
        <button
          type="button"
          className={styles.dismissBtn}
          disabled={disabled}
          onClick={() => { void onDismiss(); }}
        >
          {t('whisperDismiss')}
        </button>
      </div>
    </>
  );
}
