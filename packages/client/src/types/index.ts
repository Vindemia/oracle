export type Quadrant = 'FIRE' | 'STARS' | 'WIND' | 'MIST';

export type TaskStatus = 'ACTIVE' | 'DONE' | 'ELIMINATED';

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
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
  userId: string;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
