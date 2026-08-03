import { ScrollIcon, GearIcon, SignOutIcon, QuestionIcon, FeatherIcon, WindIcon, SunHorizonIcon, SparkleIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFireAlert } from '../context/FireAlertContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useWhispers } from '../hooks/useWhispers.js';
import { useRitual } from '../hooks/useRitual.js';
import { HelpDrawer } from './HelpDrawer.js';
import { FeedbackOverlay } from './FeedbackOverlay.js';
import { WhisperCapture } from './WhisperCapture.js';
import { WhisperTriage } from './WhisperTriage.js';
import { StarParticles } from './StarParticles.js';
import { STAR_PULSE_EVENT } from '../utils/animations.js';
import styles from './Header.module.css';

const WHISPER_LONG_PRESS_MS = 500;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { hasFireTasks } = useFireAlert();
  const { t } = useTheme();
  const { whispers, capture, reveal, dismiss } = useWhispers();
  // Le rappel du rituel disparaît une fois le rituel fait — jamais d'insistance
  // intra-journée (v3-03).
  const { status: ritualStatus } = useRitual();
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [whisperCaptureOpen, setWhisperCaptureOpen] = useState(false);
  const [whisperTriageOpen, setWhisperTriageOpen] = useState(false);
  const [starPulse, setStarPulse] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  // Renforcement immédiat (v3-05) : signal transverse unique — dispatché par
  // useTasks() à chaque complétion, écouté ici plutôt que dans chaque écran.
  useEffect(() => {
    const handler = () => { setStarPulse(true); };
    window.addEventListener(STAR_PULSE_EVENT, handler);
    return () => { window.removeEventListener(STAR_PULSE_EVENT, handler); };
  }, []);

  const isFocus = location.pathname === '/focus';

  const toggle = (path: string) => {
    void navigate(location.pathname === path ? '/' : path);
  };

  const openTriage = () => {
    setWhisperCaptureOpen(false);
    setWhisperTriageOpen(true);
  };

  const openCapture = () => {
    setWhisperTriageOpen(false);
    setWhisperCaptureOpen(true);
  };

  // Raccourci clavier global "n" (hors champ de saisie) → ouvre la capture instantanée.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      openCapture();
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, []);

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      openTriage();
    }, WHISPER_LONG_PRESS_MS);
  };

  const handleWhisperClick = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    // Second clic (capture déjà ouverte) → bascule vers la liste de tri.
    if (whisperCaptureOpen) {
      openTriage();
    } else {
      openCapture();
    }
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <button
            className={styles.titleBtn}
            onClick={() => { void navigate('/'); }}
            aria-label="Accueil"
          >
            ✦ Oracle
          </button>
        </div>

        <div className={styles.center}>
          <button
            className={[
              styles.focusBtn,
              isFocus ? styles.focusBtnReturn : styles.focusBtnEnter,
              !isFocus && hasFireTasks ? styles.focusBtnFire : null,
            ].filter(Boolean).join(' ')}
            onClick={() => { void navigate(isFocus ? '/' : '/focus'); }}
            aria-label={isFocus ? 'Retour à la Matrice' : 'Entrer en mode Focus'}
          >
            <span className={styles.focusBtnIcon} aria-hidden="true">✦</span>
            <span className={styles.focusBtnLabel}>
              {isFocus ? 'Matrice' : 'Focus'}
            </span>
          </button>
        </div>

        <div className={styles.right}>
          <div className={styles.actions}>
            {ritualStatus !== null && !ritualStatus.ritualDoneToday && (
              <button
                className={[styles.iconBtn, location.pathname === '/ritual' ? styles.active : null].filter(Boolean).join(' ')}
                onClick={() => { void navigate('/ritual'); }}
                aria-label={t('morningRitual')}
                title={t('morningRitual')}
              >
                <SunHorizonIcon size={20} weight={location.pathname === '/ritual' ? 'duotone' : 'regular'} />
                <span className={styles.dot} aria-hidden="true" />
              </button>
            )}
            <span className={styles.constellationAnchor}>
              <button
                className={[styles.iconBtn, location.pathname === '/constellation' ? styles.active : null].filter(Boolean).join(' ')}
                onClick={() => { toggle('/constellation'); }}
                aria-label={t('progress')}
                title={t('progress')}
              >
                <SparkleIcon size={20} weight={location.pathname === '/constellation' ? 'duotone' : 'regular'} />
              </button>
              <StarParticles active={starPulse} onDone={() => { setStarPulse(false); }} />
            </span>
            <button
              className={[styles.iconBtn, location.pathname === '/history' ? styles.active : null].filter(Boolean).join(' ')}
              onClick={() => { toggle('/history'); }}
              aria-label={t('historyTitle')}
              title={t('historyTitle')}
            >
              <ScrollIcon size={20} weight={location.pathname === '/history' ? 'duotone' : 'regular'} />
            </button>
            <button
              className={[styles.iconBtn, location.pathname === '/settings' ? styles.active : null].filter(Boolean).join(' ')}
              onClick={() => { toggle('/settings'); }}
              aria-label="Réglages"
              title="Réglages"
            >
              <GearIcon size={20} weight={location.pathname === '/settings' ? 'duotone' : 'regular'} />
            </button>
            <button
              className={[styles.iconBtn, helpOpen ? styles.active : null].filter(Boolean).join(' ')}
              onClick={() => { setHelpOpen((v) => !v); }}
              aria-label="Guide — Matrice d'Eisenhower"
              title="Guide"
            >
              <QuestionIcon size={20} weight={helpOpen ? 'duotone' : 'regular'} />
            </button>
            <button
              className={[styles.iconBtn, feedbackOpen ? styles.active : null].filter(Boolean).join(' ')}
              onClick={() => { setFeedbackOpen(true); }}
              aria-label={`Envoyer un ${t('feedback')}`}
              title={t('feedbackTitle')}
            >
              <FeatherIcon size={20} weight={feedbackOpen ? 'duotone' : 'regular'} />
            </button>
            <button
              className={[styles.iconBtn, (whisperCaptureOpen || whisperTriageOpen) ? styles.active : null].filter(Boolean).join(' ')}
              onClick={handleWhisperClick}
              onPointerDown={startLongPress}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              aria-label={`Capturer un ${t('quickNote')}`}
              title={t('quickNote')}
            >
              <WindIcon size={20} weight={(whisperCaptureOpen || whisperTriageOpen) ? 'duotone' : 'regular'} />
              {whispers.length > 0 && (
                <span className={styles.badge} aria-hidden="true">{whispers.length}</span>
              )}
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => { void logout(); }}
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <SignOutIcon size={20} weight="regular" />
            </button>
          </div>
        </div>
      </header>
      <HelpDrawer open={helpOpen} onClose={() => { setHelpOpen(false); }} />
      <FeedbackOverlay open={feedbackOpen} onClose={() => { setFeedbackOpen(false); }} />
      <WhisperCapture
        open={whisperCaptureOpen}
        onClose={() => { setWhisperCaptureOpen(false); }}
        capture={capture}
        whisperCount={whispers.length}
        onViewTriage={openTriage}
      />
      <WhisperTriage
        open={whisperTriageOpen}
        onClose={() => { setWhisperTriageOpen(false); }}
        whispers={whispers}
        reveal={reveal}
        dismiss={dismiss}
      />
    </>
  );
}
