import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateAccessToken } from '../auth/auth.service.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    task: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const token = generateAccessToken(USER_ID);

function mockTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Vision test',
    urgent: false,
    important: false,
    quadrant: 'MIST',
    status: 'ACTIVE',
    position: 0,
    userId: USER_ID,
    notes: null,
    plannedFor: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    tags: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/tasks', () => {
  it('urgent=true, important=true → quadrant FIRE', async () => {
    const task = mockTask({ urgent: true, important: true, quadrant: 'FIRE' });
    vi.mocked(prismaMock.task.aggregate).mockResolvedValue({ _max: { position: null } } as never);
    vi.mocked(prismaMock.task.create).mockResolvedValue(task as never);

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tâche urgente', urgent: true, important: true });

    expect(res.status).toBe(201);
    expect(res.body.quadrant).toBe('FIRE');
    expect(vi.mocked(prismaMock.task.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quadrant: 'FIRE', position: 0 }),
      }),
    );
  });

  it('urgent=false, important=false → quadrant MIST', async () => {
    const task = mockTask({ quadrant: 'MIST' });
    vi.mocked(prismaMock.task.aggregate).mockResolvedValue({ _max: { position: 2 } } as never);
    vi.mocked(prismaMock.task.create).mockResolvedValue(task as never);

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tâche flottante', urgent: false, important: false });

    expect(res.status).toBe(201);
    expect(res.body.quadrant).toBe('MIST');
    expect(vi.mocked(prismaMock.task.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quadrant: 'MIST', position: 3 }),
      }),
    );
  });

  it('400 si title manquant', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ urgent: true, important: false });

    expect(res.status).toBe(400);
  });

  it('401 sans token', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test', urgent: true, important: true });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('passer urgent=true sur une tâche STARS → quadrant FIRE', async () => {
    const existing = mockTask({ urgent: false, important: true, quadrant: 'STARS' });
    const updated = mockTask({ urgent: true, important: true, quadrant: 'FIRE' });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.aggregate).mockResolvedValue({ _max: { position: null } } as never);
    vi.mocked(prismaMock.task.update).mockResolvedValue(updated as never);

    const res = await request(app)
      .patch('/api/tasks/task-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ urgent: true });

    expect(res.status).toBe(200);
    expect(res.body.quadrant).toBe('FIRE');
    expect(vi.mocked(prismaMock.task.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quadrant: 'FIRE' }),
      }),
    );
  });

  it('404 si la tâche appartient à un autre utilisateur', async () => {
    const otherTask = mockTask({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(otherTask as never);

    const res = await request(app)
      .patch('/api/tasks/task-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hack' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it('404 si tâche inexistante', async () => {
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/tasks/unknown-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Nouveau titre' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/tasks', () => {
  it('retourne uniquement les tâches de l\'utilisateur connecté', async () => {
    const tasks = [mockTask(), mockTask({ id: 'task-2', title: 'Vision 2' })];
    vi.mocked(prismaMock.task.findMany).mockResolvedValue(tasks as never);

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(vi.mocked(prismaMock.task.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID }),
      }),
    );
  });

  it('applique le filtre ?status=DONE', async () => {
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([] as never);

    const res = await request(app)
      .get('/api/tasks?status=DONE')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(vi.mocked(prismaMock.task.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, status: 'DONE' }),
      }),
    );
  });
});

describe('POST /api/tasks/:id/complete', () => {
  it('passe status → DONE et renseigne completedAt', async () => {
    const completedAt = new Date();
    const existing = mockTask();
    const updated = mockTask({ status: 'DONE', completedAt });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.update).mockResolvedValue(updated as never);

    const res = await request(app)
      .post('/api/tasks/task-1/complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DONE');
    expect(res.body.completedAt).toBeDefined();
    expect(vi.mocked(prismaMock.task.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DONE' }),
      }),
    );
  });
});

describe('POST /api/tasks/:id/reactivate', () => {
  it('passe status → ACTIVE et completedAt → null', async () => {
    const existing = mockTask({ status: 'DONE', completedAt: new Date() });
    const reactivated = mockTask({ status: 'ACTIVE', completedAt: null });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.update).mockResolvedValue(reactivated as never);

    const res = await request(app)
      .post('/api/tasks/task-1/reactivate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.completedAt).toBeNull();
    expect(vi.mocked(prismaMock.task.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', completedAt: null }),
      }),
    );
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('supprime la tâche et retourne 204', async () => {
    const existing = mockTask();
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.delete).mockResolvedValue(existing as never);

    const res = await request(app)
      .delete('/api/tasks/task-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(vi.mocked(prismaMock.task.delete)).toHaveBeenCalledWith({
      where: { id: 'task-1' },
    });
  });

  it('404 si tâche d\'un autre utilisateur', async () => {
    const otherTask = mockTask({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(otherTask as never);

    const res = await request(app)
      .delete('/api/tasks/task-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(prismaMock.task.delete).not.toHaveBeenCalled();
  });
});

describe('POST /api/tasks/reorder', () => {
  const TASK_ID_1 = '00000000-0000-4000-8000-000000000001';
  const TASK_ID_2 = '00000000-0000-4000-8000-000000000002';

  it('200 avec positions valides', async () => {
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([
      { id: TASK_ID_1, userId: USER_ID },
      { id: TASK_ID_2, userId: USER_ID },
    ] as never);
    vi.mocked(prismaMock.$transaction).mockResolvedValue([] as never);

    const res = await request(app)
      .post('/api/tasks/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send([
        { id: TASK_ID_1, position: 0 },
        { id: TASK_ID_2, position: 1 },
      ]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('403 si une tâche appartient à un autre utilisateur', async () => {
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([
      { id: TASK_ID_1, userId: USER_ID },
      { id: TASK_ID_2, userId: OTHER_USER_ID },
    ] as never);

    const res = await request(app)
      .post('/api/tasks/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send([
        { id: TASK_ID_1, position: 0 },
        { id: TASK_ID_2, position: 1 },
      ]);

    expect(res.status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('400 si body invalide (tableau vide)', async () => {
    const res = await request(app)
      .post('/api/tasks/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send([]);

    expect(res.status).toBe(400);
  });

  it('400 si body invalide (position négative)', async () => {
    const res = await request(app)
      .post('/api/tasks/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send([{ id: TASK_ID_1, position: -1 }]);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/tasks — champs plannedFor et notes', () => {
  it('retourne plannedFor et notes dans chaque tâche', async () => {
    const tasks = [mockTask(), mockTask({ id: 'task-2', plannedFor: new Date('2099-01-01T10:00:00Z'), notes: 'une note' })];
    vi.mocked(prismaMock.task.findMany).mockResolvedValue(tasks as never);

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('plannedFor', null);
    expect(res.body[0]).toHaveProperty('notes', null);
    expect(res.body[1].plannedFor).toBe('2099-01-01T10:00:00.000Z');
    expect(res.body[1].notes).toBe('une note');
  });
});

describe('POST /api/tasks/:id/plan', () => {
  it('planifie la tâche avec une date valide dans le futur', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const existing = mockTask();
    const updated = mockTask({ plannedFor: new Date(futureDate) });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.update).mockResolvedValue(updated as never);

    const res = await request(app)
      .post('/api/tasks/task-1/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ plannedFor: futureDate });

    expect(res.status).toBe(200);
    expect(res.body.plannedFor).toBeDefined();
    expect(vi.mocked(prismaMock.task.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plannedFor: new Date(futureDate) }),
      }),
    );
  });

  it('400 si la date est dans le passé', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();

    const res = await request(app)
      .post('/api/tasks/task-1/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ plannedFor: pastDate });

    expect(res.status).toBe(400);
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it('400 si plannedFor est absent ou invalide', async () => {
    const res = await request(app)
      .post('/api/tasks/task-1/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ plannedFor: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  it('404 si la tâche appartient à un autre utilisateur', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const otherTask = mockTask({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(otherTask as never);

    const res = await request(app)
      .post('/api/tasks/task-1/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ plannedFor: futureDate });

    expect(res.status).toBe(404);
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it('404 si tâche inexistante', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tasks/task-1/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ plannedFor: futureDate });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tasks/:id/unplan', () => {
  it('retire la date plannedFor', async () => {
    const existing = mockTask({ plannedFor: new Date('2099-01-01T10:00:00Z') });
    const updated = mockTask({ plannedFor: null });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.update).mockResolvedValue(updated as never);

    const res = await request(app)
      .post('/api/tasks/task-1/unplan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plannedFor).toBeNull();
    expect(vi.mocked(prismaMock.task.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plannedFor: null }),
      }),
    );
  });

  it('404 si tâche d\'un autre utilisateur', async () => {
    const otherTask = mockTask({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(otherTask as never);

    const res = await request(app)
      .post('/api/tasks/task-1/unplan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });
});
