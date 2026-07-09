import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateAccessToken } from '../auth/auth.service.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    whisper: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const token = generateAccessToken(USER_ID);

function mockWhisper(overrides: Record<string, unknown> = {}) {
  return {
    id: 'whisper-1',
    text: 'Un murmure',
    createdAt: new Date('2026-07-09T08:00:00Z'),
    userId: USER_ID,
    ...overrides,
  };
}

function mockTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Un murmure',
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

describe('GET /api/whispers', () => {
  it('retourne les murmures de l\'utilisateur connecté, triés createdAt asc', async () => {
    const whispers = [mockWhisper(), mockWhisper({ id: 'whisper-2', text: 'Un autre' })];
    vi.mocked(prismaMock.whisper.findMany).mockResolvedValue(whispers as never);

    const res = await request(app)
      .get('/api/whispers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(vi.mocked(prismaMock.whisper.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('401 sans token', async () => {
    const res = await request(app).get('/api/whispers');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/whispers', () => {
  it('crée un murmure', async () => {
    const whisper = mockWhisper();
    vi.mocked(prismaMock.whisper.create).mockResolvedValue(whisper as never);

    const res = await request(app)
      .post('/api/whispers')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Un murmure' });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe('Un murmure');
    expect(vi.mocked(prismaMock.whisper.create)).toHaveBeenCalledWith({
      data: { text: 'Un murmure', userId: USER_ID },
    });
  });

  it('400 si texte vide', async () => {
    const res = await request(app)
      .post('/api/whispers')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '' });

    expect(res.status).toBe(400);
    expect(prismaMock.whisper.create).not.toHaveBeenCalled();
  });

  it('400 si texte > 500 caractères', async () => {
    const res = await request(app)
      .post('/api/whispers')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(prismaMock.whisper.create).not.toHaveBeenCalled();
  });

  it('401 sans token', async () => {
    const res = await request(app)
      .post('/api/whispers')
      .send({ text: 'Un murmure' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/whispers/:id', () => {
  it('supprime le murmure et retourne 204', async () => {
    const existing = mockWhisper();
    vi.mocked(prismaMock.whisper.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.whisper.delete).mockResolvedValue(existing as never);

    const res = await request(app)
      .delete('/api/whispers/whisper-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(vi.mocked(prismaMock.whisper.delete)).toHaveBeenCalledWith({
      where: { id: 'whisper-1' },
    });
  });

  it('404 si le murmure appartient à un autre utilisateur', async () => {
    const otherWhisper = mockWhisper({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.whisper.findUnique).mockResolvedValue(otherWhisper as never);

    const res = await request(app)
      .delete('/api/whispers/whisper-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(prismaMock.whisper.delete).not.toHaveBeenCalled();
  });

  it('404 si murmure inexistant', async () => {
    vi.mocked(prismaMock.whisper.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/whispers/unknown-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/whispers/:id/reveal', () => {
  it('crée la tâche avec le quadrant calculé serveur et supprime le murmure', async () => {
    const existing = mockWhisper({ text: 'Appeler le dentiste' });
    const created = mockTask({ title: 'Appeler le dentiste', urgent: true, important: true, quadrant: 'FIRE' });
    vi.mocked(prismaMock.whisper.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.aggregate).mockResolvedValue({ _max: { position: null } } as never);
    vi.mocked(prismaMock.$transaction).mockResolvedValue([created, existing] as never);

    const res = await request(app)
      .post('/api/whispers/whisper-1/reveal')
      .set('Authorization', `Bearer ${token}`)
      .send({ urgent: true, important: true });

    expect(res.status).toBe(201);
    expect(res.body.quadrant).toBe('FIRE');
    expect(res.body.title).toBe('Appeler le dentiste');
    expect(vi.mocked(prismaMock.$transaction)).toHaveBeenCalledTimes(1);
    const transactionArg = vi.mocked(prismaMock.$transaction).mock.calls[0]?.[0];
    expect(Array.isArray(transactionArg) ? transactionArg : []).toHaveLength(2);
  });

  it('associe les tagIds fournis à la tâche créée', async () => {
    const TAG_ID = '00000000-0000-4000-8000-000000000001';
    const existing = mockWhisper();
    const created = mockTask({ tags: [{ id: TAG_ID, name: 'Perso', icon: '🏠', color: '#fff', isDefault: false, userId: USER_ID, createdAt: new Date() }] });
    vi.mocked(prismaMock.whisper.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.task.aggregate).mockResolvedValue({ _max: { position: 1 } } as never);
    vi.mocked(prismaMock.$transaction).mockResolvedValue([created, existing] as never);

    const res = await request(app)
      .post('/api/whispers/whisper-1/reveal')
      .set('Authorization', `Bearer ${token}`)
      .send({ urgent: false, important: true, tagIds: [TAG_ID] });

    expect(res.status).toBe(201);
    expect(res.body.tags).toHaveLength(1);
  });

  it('404 (pas 403) si le murmure appartient à un autre utilisateur', async () => {
    const otherWhisper = mockWhisper({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.whisper.findUnique).mockResolvedValue(otherWhisper as never);

    const res = await request(app)
      .post('/api/whispers/whisper-1/reveal')
      .set('Authorization', `Bearer ${token}`)
      .send({ urgent: true, important: false });

    expect(res.status).toBe(404);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('404 si murmure inexistant', async () => {
    vi.mocked(prismaMock.whisper.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/whispers/unknown-id/reveal')
      .set('Authorization', `Bearer ${token}`)
      .send({ urgent: true, important: false });

    expect(res.status).toBe(404);
  });

  it('400 si urgent/important manquants', async () => {
    const res = await request(app)
      .post('/api/whispers/whisper-1/reveal')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(prismaMock.whisper.findUnique).not.toHaveBeenCalled();
  });

  it('401 sans token', async () => {
    const res = await request(app)
      .post('/api/whispers/whisper-1/reveal')
      .send({ urgent: true, important: false });

    expect(res.status).toBe(401);
  });
});
