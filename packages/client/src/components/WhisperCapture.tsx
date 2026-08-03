import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '@phosphor-icons/react';
import { useTheme } from '../context/ThemeContext.js';
import { useToast } from '../context/ToastContext.js';
import styles from './WhisperCapture.module.css';

interface WhisperCaptureProps {
  open: boolean;
  onClose: () => void;
  capture: (text: string) => Promise<void>;
  whisperCount: number;
  onViewTriage: () => void;
}

/**
 * Boîte de capture instantanée — un seul champ, Entrée = capturé (champ vidé,
 * overlay gardé ouvert pour la capture en rafale), Échap = fermé. Aucun tri
 * ici : classer au moment de noter est la friction qu'on élimine (v3-02).
 */
export function WhisperCapture({ open, onClose, capture, whisperCount, onViewTriage }: WhisperCaptureProps) {
  const { t } = useTheme();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => { inputRef.current?.focus(); }, 0);
    return () => { clearTimeout(id); };
  }, [open]);

  const handleClose = () => {
    onClose();
    setText('');
    setIsSending(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await capture(trimmed);
      showToast(t('whisperCaptured'), 'special');
      setText('');
      inputRef.current?.focus();
    } catch {
      // l'optimistic update a déjà été annulé par capture() — le texte reste
      // affiché pour que l'utilisatrice puisse réessayer sans le retaper.
    } finally {
      setIsSending(false);
    }
  };

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('whisperPlaceholder')}>
      <div className={styles.box}>
        <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="Fermer">
          <XIcon size={18} weight="bold" />
        </button>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder={t('whisperPlaceholder')}
          value={text}
          onChange={(e) => { setText(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { void handleSubmit(); }
          }}
          disabled={isSending}
          aria-label={t('whisperPlaceholder')}
        />
        {whisperCount > 0 && (
          // L'icône « murmure » du header ouvre normalement le tri au second clic,
          // mais cet overlay plein écran (au-dessus du header) rend ce clic
          // inatteignable tant que la capture est ouverte — lien direct en secours.
          <button type="button" className={styles.viewTriageBtn} onClick={onViewTriage}>
            Voir {whisperCount.toString()} {t('quickNote')}{whisperCount > 1 ? 's' : ''} en attente →
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
