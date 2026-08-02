import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateAccessToken } from '../auth/auth.service.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    task: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    taskStep: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const token = generateAccessToken(USER_ID);

function mockStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    title: 'Ouvrir le dossier',
    done: false,
    position: 0,
    taskId: 'task-1',
    ...overrides,
  };
}

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
    steps: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // promoteDueTasks() (filet paresseux du GET /tasks) s'appuie sur groupBy ;
  // par défaut aucune tâche en retard (le test qui l'exerce le mock différemment).
  vi.mocked(prismaMock.task.groupBy).mockResolvedValue([] as never);
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

  it('réinitialise reminderSentAt lors de la (re)planification', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    // Tâche déjà rappelée par le passé, qu'on re-planifie à une nouvelle échéance.
    const existing = mockTask({ reminderSentAt: new Date('2026-01-01T00:00:00Z') });
    const updated = mockTask({ plannedFor: new Date(futureDate), reminderSentAt: null });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.update).mockResolvedValue(updated as never);

    const res = await request(app)
      .post('/api/tasks/task-1/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ plannedFor: futureDate });

    expect(res.status).toBe(200);
    expect(vi.mocked(prismaMock.task.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reminderSentAt: null }),
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
  it('retire la date plannedFor et réinitialise reminderSentAt', async () => {
    const existing = mockTask({
      plannedFor: new Date('2099-01-01T10:00:00Z'),
      reminderSentAt: new Date('2026-01-01T00:00:00Z'),
    });
    const updated = mockTask({ plannedFor: null, reminderSentAt: null });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.update).mockResolvedValue(updated as never);

    const res = await request(app)
      .post('/api/tasks/task-1/unplan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plannedFor).toBeNull();
    expect(vi.mocked(prismaMock.task.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plannedFor: null, reminderSentAt: null }),
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

describe('GET /api/tasks — steps', () => {
  it('retourne les steps triés par position', async () => {
    const tasks = [
      mockTask({
        steps: [mockStep({ id: 's1', position: 0 }), mockStep({ id: 's2', title: 'Suite', position: 1 })],
      }),
    ];
    vi.mocked(prismaMock.task.findMany).mockResolvedValue(tasks as never);

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].steps).toEqual([
      { id: 's1', title: 'Ouvrir le dossier', done: false, position: 0 },
      { id: 's2', title: 'Suite', done: false, position: 1 },
    ]);
    // Prisma étant mocké, l'assertion ci-dessus ne prouve pas le tri : elle vérifie
    // que le mock ressort tel quel. C'est la requête qui doit porter l'orderBy.
    expect(vi.mocked(prismaMock.task.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          steps: { orderBy: { position: 'asc' } },
        }),
      }),
    );
  });
});

describe('POST /api/tasks/:id/steps', () => {
  it('ajoute un fragment en fin de liste', async () => {
    const existing = mockTask();
    const existingSteps = [mockStep({ id: 's1', position: 0 }), mockStep({ id: 's2', position: 1 })];
    const updated = mockTask({ steps: [...existingSteps, mockStep({ id: 's3', position: 2 })] });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.taskStep.findMany).mockResolvedValue(existingSteps as never);
    vi.mocked(prismaMock.taskStep.create).mockResolvedValue(mockStep({ id: 's3', position: 2 }) as never);
    vi.mocked(prismaMock.task.findUniqueOrThrow).mockResolvedValue(updated as never);

    const res = await request(app)
      .post('/api/tasks/task-1/steps')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Nouveau fragment' });

    expect(res.status).toBe(200);
    expect(res.body.steps).toHaveLength(3);
    expect(vi.mocked(prismaMock.taskStep.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Nouveau fragment', position: 2, taskId: 'task-1' }),
      }),
    );
  });

  it('400 au-delà de 10 fragments', async () => {
    const existing = mockTask();
    const tenSteps = Array.from({ length: 10 }, (_, i) => mockStep({ id: `s${String(i)}`, position: i }));
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.taskStep.findMany).mockResolvedValue(tenSteps as never);

    const res = await request(app)
      .post('/api/tasks/task-1/steps')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Un fragment de trop' });

    expect(res.status).toBe(400);
    expect(prismaMock.taskStep.create).not.toHaveBeenCalled();
  });

  it('400 si title vide', async () => {
    const res = await request(app)
      .post('/api/tasks/task-1/steps')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '' });

    expect(res.status).toBe(400);
  });

  it('404 si la tâche appartient à un autre utilisateur', async () => {
    const otherTask = mockTask({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(otherTask as never);

    const res = await request(app)
      .post('/api/tasks/task-1/steps')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hack' });

    expect(res.status).toBe(404);
    expect(prismaMock.taskStep.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/tasks/:id/steps/:stepId', () => {
  it('coche un fragment (done)', async () => {
    const existing = mockTask();
    const step = mockStep({ done: false });
    const updatedTask = mockTask({ steps: [mockStep({ done: true })] });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.taskStep.findUnique).mockResolvedValue(step as never);
    vi.mocked(prismaMock.taskStep.update).mockResolvedValue(mockStep({ done: true }) as never);
    vi.mocked(prismaMock.task.findUniqueOrThrow).mockResolvedValue(updatedTask as never);

    const res = await request(app)
      .patch('/api/tasks/task-1/steps/step-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ done: true });

    expect(res.status).toBe(200);
    expect(res.body.steps[0].done).toBe(true);
    expect(vi.mocked(prismaMock.taskStep.update)).toHaveBeenCalledWith({
      where: { id: 'step-1' },
      data: { done: true },
    });
  });

  it('404 sur un step orphelin (appartenant à une autre tâche)', async () => {
    const existing = mockTask();
    const orphanStep = mockStep({ taskId: 'other-task' });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.taskStep.findUnique).mockResolvedValue(orphanStep as never);

    const res = await request(app)
      .patch('/api/tasks/task-1/steps/step-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ done: true });

    expect(res.status).toBe(404);
    expect(prismaMock.taskStep.update).not.toHaveBeenCalled();
  });

  it('404 si la tâche appartient à un autre utilisateur', async () => {
    const otherTask = mockTask({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(otherTask as never);

    const res = await request(app)
      .patch('/api/tasks/task-1/steps/step-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ done: true });

    expect(res.status).toBe(404);
    expect(prismaMock.taskStep.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/tasks/:id/steps/:stepId', () => {
  it('retire le fragment et retourne la tâche sérialisée', async () => {
    const existing = mockTask();
    const step = mockStep();
    const updatedTask = mockTask({ steps: [] });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.taskStep.findUnique).mockResolvedValue(step as never);
    vi.mocked(prismaMock.taskStep.delete).mockResolvedValue(step as never);
    vi.mocked(prismaMock.task.findUniqueOrThrow).mockResolvedValue(updatedTask as never);

    const res = await request(app)
      .delete('/api/tasks/task-1/steps/step-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.steps).toEqual([]);
    expect(vi.mocked(prismaMock.taskStep.delete)).toHaveBeenCalledWith({ where: { id: 'step-1' } });
  });

  it('404 sur un step orphelin (appartenant à une autre tâche)', async () => {
    const existing = mockTask();
    const orphanStep = mockStep({ taskId: 'other-task' });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.taskStep.findUnique).mockResolvedValue(orphanStep as never);

    const res = await request(app)
      .delete('/api/tasks/task-1/steps/step-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(prismaMock.taskStep.delete).not.toHaveBeenCalled();
  });

  it('404 si la tâche appartient à un autre utilisateur', async () => {
    const otherTask = mockTask({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.task.findUnique).mockResolvedValue(otherTask as never);

    const res = await request(app)
      .delete('/api/tasks/task-1/steps/step-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(prismaMock.taskStep.delete).not.toHaveBeenCalled();
  });
});
