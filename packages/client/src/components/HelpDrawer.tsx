import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '@phosphor-icons/react';
import styles from './HelpDrawer.module.css';

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, [open, onClose]);

  return createPortal(
    <aside
        className={[styles.drawer, open ? styles.drawerOpen : undefined].filter(Boolean).join(' ')}
        role="complementary"
        aria-label="Centre d'aide"
        aria-hidden={!open}
      >
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Guide Oracle</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fermer l'aide"
          >
            <XIcon size={20} weight="bold" />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.intro}>
            La matrice d'Eisenhower classe chaque vision selon deux axes —
            urgence et importance — pour révéler quoi faire maintenant, planifier,
            déléguer ou laisser passer.
          </p>

          {/* ── Les 4 quadrants ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Les 4 quadrants</h3>

            <div className={styles.quadrant} data-q="fire">
              <div className={styles.quadrantHeader}>
                <span className={styles.quadrantIcon}>🔥</span>
                <span className={styles.quadrantName}>Feu — Faire maintenant</span>
              </div>
              <p className={styles.quadrantDesc}>
                Urgent <em>et</em> important. Crises, deadlines imminentes, problèmes bloquants.
                À traiter sans délai.
              </p>
            </div>

            <div className={styles.quadrant} data-q="stars">
              <div className={styles.quadrantHeader}>
                <span className={styles.quadrantIcon}>✦</span>
                <span className={styles.quadrantName}>Étoiles — Planifier</span>
              </div>
              <p className={styles.quadrantDesc}>
                Important, non urgent. Objectifs à long terme, développement personnel,
                stratégie. Bloquer du temps pour ces tâches.
              </p>
            </div>

            <div className={styles.quadrant} data-q="wind">
              <div className={styles.quadrantHeader}>
                <span className={styles.quadrantIcon}>💨</span>
                <span className={styles.quadrantName}>Vent — Déléguer</span>
              </div>
              <p className={styles.quadrantDesc}>
                Urgent, non important. Interruptions, demandes routinières pressées.
                Déléguer ou traiter rapidement.
              </p>
            </div>

            <div className={styles.quadrant} data-q="mist">
              <div className={styles.quadrantHeader}>
                <span className={styles.quadrantIcon}>🌫</span>
                <span className={styles.quadrantName}>Brume — Laisser passer</span>
              </div>
              <p className={styles.quadrantDesc}>
                Ni urgent ni important. Distractions, habitudes inutiles, tâches confort.
                À éliminer ou ignorer.
              </p>
            </div>
          </section>

          {/* ── Urgence ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>⚡ Évaluer l'urgence</h3>
            <p className={styles.sectionIntro}>Une vision est urgente si :</p>
            <ul className={styles.criteriaList}>
              <li>Ne pas le faire <strong>aujourd'hui</strong> entraîne une vraie conséquence</li>
              <li>Quelqu'un attend une réponse ou une livraison de ta part</li>
              <li>Il y a une <strong>échéance fixe</strong> dans les prochaines heures ou le jour même</li>
            </ul>
            <p className={styles.tip}>
              L'urgence est souvent <em>externe</em> — imposée par les événements ou les autres.
            </p>
          </section>

          {/* ── Importance ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>✦ Évaluer l'importance</h3>
            <p className={styles.sectionIntro}>Une vision est importante si :</p>
            <ul className={styles.criteriaList}>
              <li>Elle te rapproche d'un objectif qui compte <strong>vraiment</strong> pour toi</li>
              <li>Tu la regretterais dans 6 mois si elle n'est pas accomplie</li>
              <li>Elle a un <strong>impact durable</strong> sur ta vie, ton projet ou tes relations</li>
            </ul>
            <p className={styles.tip}>
              L'importance est souvent <em>interne</em> — définie par tes valeurs et tes objectifs.
            </p>
          </section>

          {/* ── Piège ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>⚠ Piège courant</h3>
            <p className={styles.trapText}>
              On confond souvent <strong>urgent</strong> et <strong>important</strong>.
              Une notification urgente peut être insignifiante ; une décision capitale peut ne pas être pressée.
            </p>
            <p className={styles.trapText}>
              Les personnes débordées vivent dans le 🔥 <em>Feu</em>.
              Les personnes épanouies protègent du temps pour les ✦ <em>Étoiles</em>.
            </p>
          </section>
        </div>
    </aside>,
    document.body,
  );
}
