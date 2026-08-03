import { useState } from 'react';
import { CaretLeftIcon, CaretRightIcon, SparkleIcon } from '@phosphor-icons/react';
import { useTheme } from '../context/ThemeContext.js';
import { useConstellation } from '../hooks/useConstellation.js';
import { starPosition } from '../utils/starPosition.js';
import { getQuadrantColorVar } from '../utils/quadrant.js';
import type { ConstellationStar } from '../types/index.js';
import styles from './ConstellationView.module.css';

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date((y ?? 1970), (m ?? 1) - 1, 1);
  const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function starDateLabel(completedAt: string): string {
  return new Date(completedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function plural(count: number): string {
  return count !== 1 ? 's' : '';
}

/**
 * Constellation (v3-05) — récompense cumulative qui ne régresse jamais.
 * Aucune notion de série, de manque ou de moyenne n'apparaît ici : seuls des
 * totaux qui montent (jours actifs à vie, visions accomplies ce mois-ci).
 */
export function ConstellationView() {
  const { t } = useTheme();
  const { data, isLoading, monthKey, isCurrentMonth, goToPreviousMonth, goToNextMonth } = useConstellation();
  const [selected, setSelected] = useState<ConstellationStar | null>(null);

  const completedCount = data?.completedThisMonth.length ?? 0;
  const eliminatedCount = data?.eliminatedThisMonthCount ?? 0;

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        <header className={styles.head}>
          <SparkleIcon size={26} weight="duotone" aria-hidden="true" />
          <h1 className={styles.title}>{t('progress')}</h1>
        </header>

        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goToPreviousMonth}
            aria-label="Mois précédent"
          >
            <CaretLeftIcon size={16} />
          </button>
          <span className={styles.monthLabel}>{monthLabel(monthKey)}</span>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goToNextMonth}
            disabled={isCurrentMonth}
            aria-label="Mois suivant"
          >
            <CaretRightIcon size={16} />
          </button>
        </div>

        <div className={styles.counters}>
          <p className={styles.counter}>
            <strong>{(data?.activeDaysTotal ?? 0).toString()}</strong> jour{plural(data?.activeDaysTotal ?? 0)} actif{plural(data?.activeDaysTotal ?? 0)}
          </p>
          <p className={styles.counter}>
            <strong>{completedCount.toString()}</strong> {t('task')}{plural(completedCount)} {t('tasksAccomplishedSuffix')}{plural(completedCount)} ce mois-ci
          </p>
        </div>

        <div className={styles.sky} aria-label="Ciel du mois" data-loading={isLoading}>
          {(data?.completedThisMonth ?? []).map((star) => {
            const { x, y } = starPosition(star.id);
            return (
              <button
                key={star.id}
                type="button"
                className={styles.star}
                style={{
                  left: `${x.toString()}%`,
                  top: `${y.toString()}%`,
                  color: `var(${getQuadrantColorVar(star.quadrant)})`,
                }}
                title={`${star.title} — ${starDateLabel(star.completedAt)}`}
                onClick={() => { setSelected(star); }}
                aria-label={star.title}
              >
                ✦
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <p className={styles.selected}>
            {selected.title} — {starDateLabel(selected.completedAt)}
          </p>
        )}

        {eliminatedCount > 0 && (
          <p className={styles.eliminated}>
            <strong>{eliminatedCount.toString()}</strong> {t('task')}{plural(eliminatedCount)} {t('constellationEliminatedSuffix')}{plural(eliminatedCount)}
          </p>
        )}
      </main>
    </div>
  );
}
