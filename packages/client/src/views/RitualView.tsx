import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SunHorizonIcon } from '@phosphor-icons/react';
import { useTheme } from '../context/ThemeContext.js';
import { useRitual } from '../hooks/useRitual.js';
import { useWhispers } from '../hooks/useWhispers.js';
import { WhisperTriageItem } from '../components/WhisperTriageItem.js';
import { StarParticles } from '../components/StarParticles.js';
import { pickOracleWord } from '../utils/oracle-words.js';
import { isStarredToday } from '../utils/dates.js';
import type { Task } from '../types/index.js';
import styles from './RitualView.module.css';

/** Aligné sur la limite serveur (`MAX_STARS_PER_DAY`). */
const MAX_STARS = 3;

/** Nombre de murmures suggéré à la capture du Premier Rituel — un seul suffit pour continuer. */
const SUGGESTED_CAPTURES = 3;

type Step = 'whispers' | 'stars' | 'word' | 'capture' | 'reveal' | 'star';

interface RitualViewProps {
  tasks: Task[];
  onStar: (id: string) => Promise<void>;
  onUnstar: (id: string) => Promise<void>;
}

/**
 * Rituel de l'Aube (v3-03) — moins de deux minutes, trois écrans : trier ce
 * qui traîne, choisir jusqu'à trois Étoiles, recevoir un mot. Zéro Étoile est
 * un choix valide : on ne bloque jamais la sortie du rituel.
 *
 * Variante `?first=1` (v3-15) — Premier Rituel : un compte tout neuf n'a rien
 * à trier, donc trois écrans dédiés le précèdent (capturer, réveler une seule
 * fois avec une explication, étoiler) avant de rejoindre l'écran du mot,
 * partagé avec le rituel standard. « Passer » est disponible à chaque étape.
 */
export function RitualView({ tasks, onStar, onUnstar }: RitualViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isFirst = searchParams.get('first') === '1';
  const { theme, t } = useTheme();
  const { status, isLoading: statusLoading, complete } = useRitual();
  const { whispers, isLoading: whispersLoading, capture, reveal, dismiss } = useWhispers();
  const [step, setStep] = useState<Step | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [word] = useState(() => pickOracleWord());
  const [captureText, setCaptureText] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [revealedTask, setRevealedTask] = useState<Task | null>(null);

  // L'étape initiale dépend de la variante : le Premier Rituel part toujours
  // de la capture (rien à trier sur un compte neuf) ; le rituel standard
  // saute l'étape « murmures » s'il n'y a rien en attente — et elle se
  // referme d'elle-même dès que la boîte se vide.
  useEffect(() => {
    if (whispersLoading) return;
    if (step === null) {
      setStep(isFirst ? 'capture' : whispers.length > 0 ? 'whispers' : 'stars');
    } else if (step === 'whispers' && whispers.length === 0) {
      setStep('stars');
    } else if (isFirst && step === 'reveal' && whispers.length === 0 && revealedTask === null) {
      // Le seul murmure capturé a été rendu à la brume — retour à la capture.
      setStep('capture');
    }
  }, [step, whispers.length, whispersLoading, isFirst, revealedTask]);

  // Les suggestions viennent du serveur (ordre : Brasier → planifiées → Étoiles),
  // mais leur état à jour vient de `tasks` : c'est lui qui bouge quand on étoile.
  const suggestions = useMemo(() => {
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const ordered = status?.suggestions ?? [];
    const starred = tasks.filter((task) => isStarredToday(task) && !ordered.some((s) => s.id === task.id));
    return [...ordered.map((s) => byId.get(s.id) ?? s), ...starred];
  }, [status, tasks]);

  const starredCount = tasks.filter((task) => isStarredToday(task)).length;

  const toggleStar = async (task: Task) => {
    try {
      if (isStarredToday(task)) {
        await onUnstar(task.id);
      } else if (starredCount < MAX_STARS) {
        await onStar(task.id);
      }
    } catch {
      /* rollback déjà fait par useTasks — le compteur revient à sa valeur réelle */
    }
  };

  const finish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await complete();
    } catch {
      // Le rituel a eu lieu même si l'enregistrement échoue : on n'enferme
      // personne dans un écran de fin.
    } finally {
      void navigate('/focus');
    }
  };

  const skipToMatrix = () => { void navigate('/'); };

  const submitCapture = async () => {
    const trimmed = captureText.trim();
    if (!trimmed || isCapturing) return;
    setIsCapturing(true);
    try {
      await capture(trimmed);
      setCaptureText('');
    } catch {
      // rollback déjà fait par useWhispers — le texte reste pour réessayer
    } finally {
      setIsCapturing(false);
    }
  };

  if (statusLoading || whispersLoading || step === null) {
    return <div className={styles.ritual} aria-busy="true" />;
  }

  return (
    <main className={styles.ritual}>
      <header className={styles.head}>
        <SunHorizonIcon size={28} weight="duotone" aria-hidden="true" />
        <h1 className={styles.title}>{t('morningRitual')}</h1>
      </header>

      {step === 'capture' && (
        <section className={styles.stage}>
          <p className={styles.stepHint}>
            Note trois choses qui te trottent dans la tête — n'importe lesquelles, sans réfléchir à leur importance.
          </p>
          <input
            type="text"
            className={styles.input}
            placeholder={t('whisperPlaceholder')}
            value={captureText}
            onChange={(e) => { setCaptureText(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { void submitCapture(); }
            }}
            disabled={isCapturing}
            aria-label={t('whisperPlaceholder')}
            autoFocus
          />
          <p className={styles.counter} aria-live="polite">
            {Math.min(whispers.length, SUGGESTED_CAPTURES).toString()}/{SUGGESTED_CAPTURES.toString()}
          </p>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={whispers.length === 0}
            onClick={() => { setStep('reveal'); }}
          >
            Continuer →
          </button>
          <button type="button" className={styles.skipBtn} onClick={skipToMatrix}>Passer</button>
        </section>
      )}

      {step === 'reveal' && whispers[0] !== undefined && (
        <section className={styles.stage} key={whispers[0].id}>
          <p className={styles.stepHint}>
            Urgent = ça brûle. Important = ça compte pour toi. L'Oracle placera la {t('task')} au bon endroit.
          </p>
          <div className={styles.whisper}>
            <WhisperTriageItem
              whisper={whispers[0]}
              onReveal={async (input) => {
                try {
                  const created = await reveal(whispers[0]?.id ?? '', input);
                  setRevealedTask(created);
                  try {
                    await onStar(created.id);
                  } catch {
                    /* rollback déjà fait par useTasks — la vision reste créée, non étoilée */
                  }
                  setStep('star');
                } catch { /* rollback fait par useWhispers */ }
              }}
              onDismiss={async () => {
                try {
                  await dismiss(whispers[0]?.id ?? '');
                } catch { /* rollback fait par useWhispers */ }
              }}
            />
          </div>
          <button type="button" className={styles.skipBtn} onClick={skipToMatrix}>Passer</button>
        </section>
      )}

      {step === 'star' && revealedTask !== null && (
        <section className={styles.stage}>
          <p className={styles.stepHint}>C'est ta priorité. Une seule suffit pour commencer.</p>
          <div className={styles.whisper}>
            <p className={styles.cardTitle}>{revealedTask.title}</p>
          </div>
          <button type="button" className={styles.primaryBtn} onClick={() => { setStep('word'); }}>
            Continuer →
          </button>
          <button type="button" className={styles.skipBtn} onClick={skipToMatrix}>Passer</button>
        </section>
      )}

      {step === 'whispers' && whispers[0] !== undefined && (
        <section className={styles.stage} key={whispers[0].id}>
          <p className={styles.stepHint}>
            {whispers.length.toString()} {t('quickNote')}{whispers.length > 1 ? 's' : ''} à trier
          </p>
          <div className={styles.whisper}>
            <WhisperTriageItem
              whisper={whispers[0]}
              onReveal={async (input) => {
                try {
                  await reveal(whispers[0]?.id ?? '', input);
                } catch { /* rollback fait par useWhispers */ }
              }}
              onDismiss={async () => {
                try {
                  await dismiss(whispers[0]?.id ?? '');
                } catch { /* rollback fait par useWhispers */ }
              }}
            />
          </div>
          <button type="button" className={styles.skipBtn} onClick={() => { setStep('stars'); }}>
            Trier plus tard →
          </button>
        </section>
      )}

      {step === 'stars' && (
        <section className={styles.stage}>
          <p className={styles.stepHint}>
            Choisis jusqu'à {MAX_STARS.toString()} {t('dailyStarPlural')}.
          </p>
          <p className={styles.counter} aria-live="polite">
            {starredCount.toString()}/{MAX_STARS.toString()}
          </p>

          {suggestions.length === 0 ? (
            <p className={styles.empty}>Rien à choisir aujourd'hui — et c'est très bien.</p>
          ) : (
            <ul className={styles.cards}>
              {suggestions.map((task) => {
                const starred = isStarredToday(task);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      className={[styles.card, starred ? styles.cardStarred : undefined].filter(Boolean).join(' ')}
                      aria-pressed={starred}
                      disabled={!starred && starredCount >= MAX_STARS}
                      onClick={() => { void toggleStar(task); }}
                    >
                      <span className={styles.cardTitle}>{task.title}</span>
                      {starred && <span className={styles.cardMark} aria-hidden="true">✦</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button type="button" className={styles.primaryBtn} onClick={() => { setStep('word'); }}>
            Continuer →
          </button>
        </section>
      )}

      {step === 'word' && (
        <section className={styles.stage}>
          <StarParticles active={theme.ornaments} />
          <p className={styles.stepHint}>{t('oracleWord')}</p>
          <blockquote className={styles.word}>{word}</blockquote>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={isFinishing}
            onClick={() => { void finish(); }}
          >
            Commencer la journée →
          </button>
          {isFirst && (
            <button type="button" className={styles.skipBtn} onClick={skipToMatrix}>Passer</button>
          )}
        </section>
      )}
    </main>
  );
}
