import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '@phosphor-icons/react';
import { useTheme } from '../context/ThemeContext.js';
import { WhisperTriageItem, type RevealInput } from './WhisperTriageItem.js';
import type { Task, Whisper } from '../types/index.js';
import styles from './WhisperTriage.module.css';

interface WhisperTriageProps {
  open: boolean;
  onClose: () => void;
  whispers: Whisper[];
  reveal: (id: string, input: RevealInput) => Promise<Task>;
  dismiss: (id: string) => Promise<void>;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Tri différé des murmures — chaque murmure devient une vision seulement une
 * fois classé ici (ou dans le Rituel de l'Aube, v3-03). Rien n'est envoyé à
 * MatrixView tant que ce n'est pas fait.
 */
export function WhisperTriage({ open, onClose, whispers, reveal, dismiss }: WhisperTriageProps) {
  const { t } = useTheme();
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

  // Les mutations annulent elles-mêmes leur optimistic update en cas d'échec :
  // le murmure réapparaît dans la liste, rien à rattraper ici.
  const run = async (id: string, action: () => Promise<unknown>) => {
    if (pendingId !== null) return;
    setPendingId(id);
    try {
      await action();
    } catch {
      /* rollback déjà fait par useWhispers */
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
            {whispers.map((whisper) => (
              <li key={whisper.id} className={styles.item}>
                <WhisperTriageItem
                  whisper={whisper}
                  disabled={pendingId === whisper.id}
                  onReveal={async (input) => { await run(whisper.id, () => reveal(whisper.id, input)); }}
                  onDismiss={async () => { await run(whisper.id, () => dismiss(whisper.id)); }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
