import type { Theme } from './theme.types.js';

/**
 * Le thème d'origine d'Oracle — univers céleste/mystique. Aucune régression
 * visuelle attendue : les valeurs des tokens sont celles qui vivaient dans
 * `:root` avant l'introduction des thèmes.
 */
export const oracleTheme: Theme = {
  id: 'oracle',
  name: 'Oracle',
  isPremium: false,
  ornaments: true,
  tokens: {
    '--bg-primary': '#0d0b1a',
    '--bg-secondary': '#13102a',
    '--bg-tertiary': '#1c1838',
    '--bg-surface': '#221e3d',
    '--bg-overlay': 'rgba(13, 11, 26, 0.85)',

    '--text-primary': '#e8e4f8',
    '--text-secondary': '#a89dc8',
    '--text-muted': '#6b5f8a',

    '--border-color': '#2e2855',
    '--border-subtle': '#1f1c3a',

    '--accent-gold': '#c9a84c',
    '--accent-gold-light': '#f0d080',
    '--accent-purple': '#8b5cf6',
    '--accent-purple-light': '#a78bfa',

    '--quadrant-fire': '#ef4444',
    '--quadrant-fire-bg': '#2d1212',
    '--quadrant-fire-border': '#7f1d1d',

    '--quadrant-stars': '#8b5cf6',
    '--quadrant-stars-bg': '#1e1230',
    '--quadrant-stars-border': '#4c1d95',

    '--quadrant-wind': '#38bdf8',
    '--quadrant-wind-bg': '#0c1e2e',
    '--quadrant-wind-border': '#0c4a6e',

    '--quadrant-mist': '#94a3b8',
    '--quadrant-mist-bg': '#151c24',
    '--quadrant-mist-border': '#1e293b',

    '--status-done': '#4ade80',
    '--status-eliminated': '#f87171',

    '--font-display': "'Playfair Display', Georgia, serif",
    '--font-body': "'Nunito', system-ui, sans-serif",

    '--radius-sm': '4px',
    '--radius-md': '8px',
    '--radius-lg': '12px',
    '--radius-xl': '16px',

    '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
    '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.5)',
    '--shadow-glow': '0 0 20px rgba(139, 92, 246, 0.25)',
  },
  lexicon: {
    task: 'vision',
    quickNote: 'murmure',
    goal: 'prophétie',
    notification: 'présage',

    addAction: 'Révéler',
    newTaskPlaceholder: 'Nouvelle vision...',
    newTaskAria: 'Nouvelle vision',
    eliminateAction: 'Éliminer',

    historyTitle: 'Prophéties Accomplies',
    historyEmpty: "Aucune prophétie pour l'instant.",
    tasksAccomplishedSuffix: 'accomplie',
    welcomeTitle: 'Bienvenue dans ton Oracle',
    welcomeSubtitle: 'Ajoute ta première vision pour clarifier tes priorités.',
    feedback: 'écho',
    feedbackTitle: 'Écho — dis-nous ce que tu penses',

    whisperPlaceholder: "Murmure à l'Oracle…",
    whisperCaptured: 'Murmure recueilli',
    whisperDismiss: 'Rendre à la brume',

    morningRitual: "Rituel de l'Aube",
    progress: 'Constellation',
    weeklyReview: 'Conseil des Astres',

    quadrantFireLabel: 'Le Brasier',
    quadrantStarsLabel: 'Les Étoiles',
    quadrantWindLabel: 'Le Vent',
    quadrantMistLabel: 'La Brume',

    step: 'fragment',
    newStepPlaceholder: 'Nouveau fragment…',
  },
};
