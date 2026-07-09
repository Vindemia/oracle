import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { XIcon } from '@phosphor-icons/react';
import { useFeedback } from '../hooks/useFeedback.js';
import { useToast } from '../context/ToastContext.js';
import type { FeedbackKind } from '../types/index.js';
import styles from './FeedbackOverlay.module.css';

interface FeedbackOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface ChoiceOption {
  kind: FeedbackKind;
  label: string;
  icon: string;
}

const CHOICES: ChoiceOption[] = [
  { kind: 'PRAISE', label: "J'aime", icon: '✨' },
  { kind: 'IDEA', label: 'Une idée', icon: '💡' },
  { kind: 'BUG', label: 'Quelque chose cloche', icon: '🐛' },
];

export function FeedbackOverlay({ open, onClose }: FeedbackOverlayProps) {
  const location = useLocation();
  const { sendFeedback } = useFeedback();
  const { showToast } = useToast();

  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    onClose();
    setKind(null);
    setMessage('');
    setError(null);
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

  const selected = CHOICES.find((c) => c.kind === kind) ?? null;

  const handleSend = async () => {
    if (kind === null || message.trim() === '' || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const isBug = kind === 'BUG';
      await sendFeedback({
        kind,
        message: message.trim(),
        ...(isBug
          ? { context: { route: location.pathname, userAgent: navigator.userAgent } }
          : {}),
      });
      showToast("L'Oracle a recueilli ton écho.", 'special');
      handleClose();
    } catch {
      setError("Impossible d'envoyer l'écho pour l'instant. Réessaie plus tard.");
    } finally {
      setIsSending(false);
    }
  };

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Envoyer un écho">
      <div className={styles.box}>
        <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="Fermer">
          <XIcon size={18} weight="bold" />
        </button>

        {selected === null ? (
          <>
            <h2 className={styles.title}>Un écho pour l'Oracle 🪶</h2>
            <p className={styles.subtitle}>Ton avis façonne les visions à venir.</p>
            <div className={styles.choices}>
              {CHOICES.map((choice) => (
                <button
                  key={choice.kind}
                  type="button"
                  className={styles.choiceBtn}
                  onClick={() => { setKind(choice.kind); setError(null); }}
                >
                  <span className={styles.choiceIcon} aria-hidden="true">{choice.icon}</span>
                  <span>{choice.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.title}>
              <span aria-hidden="true">{selected.icon}</span> {selected.label}
            </h2>
            <textarea
              className={styles.textarea}
              value={message}
              onChange={(e) => { setMessage(e.target.value); }}
              placeholder="Dis-nous en plus…"
              maxLength={2000}
              rows={4}
              aria-label="Ton message"
            />
            {kind === 'BUG' && (
              <p className={styles.techNote}>📎 Détails techniques joints (route, navigateur)</p>
            )}
            {error !== null && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={message.trim() === '' || isSending}
                onClick={() => { void handleSend(); }}
              >
                {isSending ? 'Envoi…' : 'Envoyer ✦'}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => { setKind(null); setError(null); }}
              >
                ← Retour
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
