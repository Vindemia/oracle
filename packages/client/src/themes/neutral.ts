import type { Theme } from './theme.types.js';

/**
 * Thème par défaut — sobre, clair, une seule couleur d'accent, aucun
 * ornement mystique. La variante sombre (`prefers-color-scheme: dark`) est
 * gérée dans `index.css` ; les valeurs ci-dessous décrivent la variante
 * claire (utilisées aussi pour la pastille de prévisualisation dans les
 * réglages).
 */
export const neutralTheme: Theme = {
  id: 'neutral',
  name: 'Neutre',
  isPremium: false,
  ornaments: false,
  tokens: {
    '--bg-primary': '#faf9f6',
    '--bg-secondary': '#f2f0ec',
    '--bg-tertiary': '#e9e6e0',
    '--bg-surface': '#ffffff',
    '--bg-overlay': 'rgba(250, 249, 246, 0.9)',

    '--text-primary': '#2a2823',
    '--text-secondary': '#6b6862',
    '--text-muted': '#96938c',

    '--border-color': '#ddd8d0',
    '--border-subtle': '#eae7e0',

    '--accent-gold': '#3f6d63',
    '--accent-gold-light': '#5c8c81',
    '--accent-purple': '#3f6d63',
    '--accent-purple-light': '#5c8c81',

    '--quadrant-fire': '#c0554a',
    '--quadrant-fire-bg': '#f7ece9',
    '--quadrant-fire-border': '#e0c4bd',

    '--quadrant-stars': '#4a5d8c',
    '--quadrant-stars-bg': '#ecf0f7',
    '--quadrant-stars-border': '#c7d1e5',

    '--quadrant-wind': '#a9822f',
    '--quadrant-wind-bg': '#f7f1e5',
    '--quadrant-wind-border': '#e3d6b8',

    '--quadrant-mist': '#7a776f',
    '--quadrant-mist-bg': '#f1efeb',
    '--quadrant-mist-border': '#ddd9d0',

    '--status-done': '#3f7d4f',
    '--status-eliminated': '#b6493e',

    '--font-display': "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    '--font-body': "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",

    '--radius-sm': '4px',
    '--radius-md': '8px',
    '--radius-lg': '12px',
    '--radius-xl': '16px',

    '--shadow-sm': '0 1px 2px rgba(20, 18, 14, 0.06)',
    '--shadow-md': '0 4px 10px rgba(20, 18, 14, 0.08)',
    '--shadow-glow': 'none',
  },
  lexicon: {
    task: 'tâche',
    quickNote: 'note rapide',
    goal: 'objectif',
    notification: 'notification',

    addAction: 'Ajouter',
    newTaskPlaceholder: 'Nouvelle tâche...',
    newTaskAria: 'Nouvelle tâche',
    eliminateAction: 'Supprimer',

    historyTitle: 'Historique',
    historyEmpty: "Aucune tâche terminée pour l'instant.",
    tasksAccomplishedSuffix: 'terminée',
    welcomeTitle: 'Bienvenue',
    welcomeSubtitle: 'Ajoute ta première tâche pour clarifier tes priorités.',
    feedback: 'retour',
    feedbackTitle: 'Retour — dis-nous ce que tu penses',

    whisperPlaceholder: 'Note rapide…',
    whisperCaptured: 'Note enregistrée',
    whisperDismiss: 'Supprimer',

    morningRitual: 'rituel du matin',
    progress: 'progression',
    weeklyReview: 'bilan de la semaine',

    quadrantFireLabel: 'Urgent & important',
    quadrantStarsLabel: 'Important',
    quadrantWindLabel: 'Urgent',
    quadrantMistLabel: 'Le reste',
  },
};
