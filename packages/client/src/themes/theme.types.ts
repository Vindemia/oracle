/**
 * Un thème = un habillage visuel (tokens CSS) + un lexique (vocabulaire de
 * l'interface). Les deux thèmes v3 (`neutral`, `oracle`) sont livrés avec le
 * build — pas de fetch, pas de table d'entitlements (v4 s'en chargera).
 */

/**
 * Ensemble fermé des termes thématisables de l'interface. Extraction
 * progressive : seules les surfaces effectivement modifiées consomment ces
 * clés pour l'instant, mais le vocabulaire cible (murmure, présage,
 * prophétie, Rituel de l'Aube, Constellation, Conseil des Astres, écho…) est
 * posé dès maintenant pour que les prochaines features du chantier v3
 * n'aient qu'à appeler `t()`.
 */
export type TermKey =
  // Vocabulaire général des tâches
  | 'task'
  | 'quickNote'
  | 'goal'
  | 'notification'
  // Actions
  | 'addAction'
  | 'newTaskPlaceholder'
  | 'newTaskAria'
  | 'eliminateAction'
  // Navigation / écrans
  | 'historyTitle'
  | 'historyEmpty'
  | 'tasksAccomplishedSuffix'
  | 'welcomeTitle'
  | 'welcomeSubtitle'
  | 'feedback'
  | 'feedbackTitle'
  // Murmures (v3-02) — capture instantanée triée au Rituel de l'Aube
  | 'whisperPlaceholder'
  | 'whisperCaptured'
  | 'whisperDismiss'
  // Rituels & fonctionnalités à venir dans le chantier v3 (posées ici pour
  // que les features suivantes n'aient pas à créer leur propre lexique)
  | 'morningRitual'
  | 'progress'
  | 'weeklyReview'
  // Quadrants
  | 'quadrantFireLabel'
  | 'quadrantStarsLabel'
  | 'quadrantWindLabel'
  | 'quadrantMistLabel'
  // Fragments (v3-01) — micro-étapes cochables d'une tâche
  | 'step'
  | 'newStepPlaceholder';

export interface Theme {
  /** Identifiant stable — persisté côté serveur (`User.themeId`) et en localStorage. */
  id: string;
  /** Nom affiché dans le sélecteur de thèmes. */
  name: string;
  /** Réservé pour la monétisation v4 — toujours `false` en v3. */
  isPremium: boolean;
  /** Custom properties CSS pour `[data-theme='<id>']` (couleurs, polices, ombres…). */
  tokens: Record<string, string>;
  /** Vocabulaire de l'interface pour ce thème. */
  lexicon: Record<TermKey, string>;
  /** Composants décoratifs (StarParticles, halos…) actifs ? */
  ornaments: boolean;
}
