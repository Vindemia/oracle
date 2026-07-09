import { useFeedback } from '../hooks/useFeedback.js';
import type { FeedbackKind } from '../types/index.js';
import styles from './FeedbackHistory.module.css';

const KIND_LABELS: Record<FeedbackKind, string> = {
  PRAISE: "✨ J'aime",
  IDEA: '💡 Idée',
  BUG: '🐛 Bug',
};

export function FeedbackHistory() {
  const { mine, isLoading } = useFeedback();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Mes échos</h2>
      {isLoading ? (
        <p className={styles.muted}>Chargement…</p>
      ) : mine.length === 0 ? (
        <p className={styles.muted}>Tu n'as pas encore envoyé d'écho — le bouton 🪶 est dans l'en-tête.</p>
      ) : (
        <ul className={styles.list}>
          {mine.map((feedback) => (
            <li key={feedback.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.kind}>{KIND_LABELS[feedback.kind]}</span>
                <span className={styles.date}>
                  {new Date(feedback.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className={styles.message}>{feedback.message}</p>
              {feedback.githubIssueUrl !== null ? (
                <a
                  href={feedback.githubIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  Voir l'issue →
                </a>
              ) : (
                <span className={styles.pending}>En cours de transmission…</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
