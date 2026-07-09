import { useState } from 'react';
import { api } from '../api/client.js';
import { THEMES } from '../themes/index.js';
import { useTheme } from '../context/ThemeContext.js';
import styles from './ThemeSettings.module.css';

export function ThemeSettings() {
  const { theme: activeTheme, setThemeId } = useTheme();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (id: string) => {
    if (id === activeTheme.id || isBusy) return;
    const previousId = activeTheme.id;
    setError(null);
    setIsBusy(true);
    // Optimistic : le visuel et le lexique changent immédiatement, avant même
    // la réponse serveur — rollback silencieux en cas d'échec de la
    // persistance (cf. pattern useTasks : optimistic update + rollback).
    setThemeId(id);
    try {
      await api.patch('/auth/me', { themeId: id });
    } catch {
      setThemeId(previousId);
      setError("Impossible d'enregistrer ce thème — réessaie plus tard.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Apparence</h2>
      <p className={styles.muted}>
        Choisis l'habillage visuel et le vocabulaire de l'interface.
      </p>

      <ul className={styles.themeList}>
        {Object.values(THEMES).map((candidate) => {
          const isActive = candidate.id === activeTheme.id;
          // Toujours false en v3 — l'emplacement est prêt pour la
          // monétisation v4 (table d'entitlements côté serveur).
          const isLocked = candidate.isPremium;

          return (
            <li key={candidate.id}>
              <button
                type="button"
                className={[styles.themeCard, isActive ? styles.themeCardActive : undefined]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => { void handleSelect(candidate.id); }}
                disabled={isBusy || isLocked}
                aria-pressed={isActive}
              >
                <span
                  className={styles.swatch}
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(135deg, ${candidate.tokens['--accent-gold'] ?? ''}, ${candidate.tokens['--bg-primary'] ?? ''})`,
                    borderColor: candidate.tokens['--border-color'] ?? 'transparent',
                  }}
                />
                <span className={styles.themeInfo}>
                  <span className={styles.themeName}>
                    {candidate.name}
                    {isLocked && (
                      <span className={styles.lockBadge} aria-label="Réservé">🔒</span>
                    )}
                  </span>
                  <span className={styles.themeSample}>
                    « {candidate.lexicon.task} » · « {candidate.lexicon.addAction} »
                  </span>
                </span>
                {isActive && (
                  <span className={styles.activeBadge} aria-hidden="true">✓</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error !== null && <p className={styles.error}>{error}</p>}
    </section>
  );
}
