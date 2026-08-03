export type Quadrant = 'FIRE' | 'STARS' | 'WIND' | 'MIST';

export type TaskStatus = 'ACTIVE' | 'DONE' | 'ELIMINATED';

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  /** Thème visuel + lexical actif — cf. packages/client/src/themes/. */
  themeId: string;
}

export interface Tag {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  userId: string;
  createdAt: string;
}

export interface TaskStep {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface Task {
  id: string;
  title: string;
  urgent: boolean;
  important: boolean;
  quadrant: Quadrant;
  status: TaskStatus;
  position: number;
  userId: string;
  tags: Tag[];
  steps: TaskStep[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  plannedFor: string | null;
  notes: string | null;
  /** Étoile du jour (v3-03) : dateKey locale `YYYY-MM-DD`, ou `null`. */
  starredOn: string | null;
}

/** État du Rituel de l'Aube pour la journée en cours (v3-03). */
export interface RitualStatus {
  ritualDoneToday: boolean;
  /** dateKey locale du dernier rituel accompli, ou `null` si jamais fait (v3-15). */
  lastRitualOn: string | null;
  whisperCount: number;
  starredToday: Task[];
  suggestions: Task[];
}

/** Une étoile du ciel du mois (v3-05) — vision accomplie, position dérivée côté client. */
export interface ConstellationStar {
  id: string;
  title: string;
  completedAt: string;
  quadrant: Quadrant;
}

/** Agrégat du mois local pour la Constellation (v3-05) — tout est dérivé, aucun nouveau modèle. */
export interface ConstellationData {
  /** Total à vie de jours actifs — ne diminue jamais. */
  activeDaysTotal: number;
  activeDaysThisMonth: string[];
  completedThisMonth: ConstellationStar[];
  eliminatedThisMonthCount: number;
}

export interface Whisper {
  id: string;
  text: string;
  createdAt: string;
}

export type FeedbackKind = 'PRAISE' | 'IDEA' | 'BUG';

export interface Feedback {
  id: string;
  kind: FeedbackKind;
  message: string;
  context: Record<string, unknown>;
  githubIssueUrl: string | null;
  syncedAt: string | null;
  createdAt: string;
  userId: string;
}
