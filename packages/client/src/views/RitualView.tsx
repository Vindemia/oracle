import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

type Step = 'whispers' | 'stars' | 'word';

interface RitualViewProps {
  tasks: Task[];
  onStar: (id: string) => Promise<void>;
  onUnstar: (id: string) => Promise<void>;
}

/**
 * Rituel de l'Aube (v3-03) — moins de deux minutes, trois écrans : trier ce
 * qui traîne, choisir jusqu'à trois Étoiles, recevoir un mot. Zéro Étoile est
 * un choix valide : on ne bloque jamais la sortie du rituel.
 */
export function RitualView({ tasks, onStar, onUnstar }: RitualViewProps) {
  const navigate = useNavigate();
  const { theme, t } = useTheme();
  const { status, isLoading: statusLoading, complete } = useRitual();
  const { whispers, isLoading: whispersLoading, reveal, dismiss } = useWhispers();
  const [step, setStep] = useState<Step | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [word] = useState(() => pickOracleWord());

  // L'étape « murmures » n'existe que s'il y a quelque chose à trier — et elle
  // se referme d'elle-même dès que la boîte est vide.
  useEffect(() => {
    if (whispersLoading) return;
    if (step === null) {
      setStep(whispers.length > 0 ? 'whispers' : 'stars');
    } else if (step === 'whispers' && whispers.length === 0) {
      setStep('stars');
    }
  }, [step, whispers.length, whispersLoading]);

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

  if (statusLoading || whispersLoading || step === null) {
    return <div className={styles.ritual} aria-busy="true" />;
  }

  return (
    <main className={styles.ritual}>
      <header className={styles.head}>
        <SunHorizonIcon size={28} weight="duotone" aria-hidden="true" />
        <h1 className={styles.title}>{t('morningRitual')}</h1>
      </header>

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
        </section>
      )}
    </main>
  );
}
