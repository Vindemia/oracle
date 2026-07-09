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
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  plannedFor: string | null;
  notes: string | null;
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
