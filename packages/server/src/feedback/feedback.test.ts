import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateAccessToken } from '../auth/auth.service.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    feedback: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');

const USER_ID = 'user-1';
const token = generateAccessToken(USER_ID);

function mockFeedback(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fb-1',
    kind: 'IDEA',
    message: 'Une idée géniale',
    context: {},
    githubIssueUrl: null,
    syncedAt: null,
    createdAt: new Date(),
    userId: USER_ID,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/feedback', () => {
  it('crée un écho et répond 201', async () => {
    vi.mocked(prismaMock.feedback.count).mockResolvedValue(0 as never);
    vi.mocked(prismaMock.feedback.create).mockResolvedValue(mockFeedback() as never);

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'IDEA', message: 'Une idée géniale' });

    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('IDEA');
    expect(vi.mocked(prismaMock.feedback.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID, kind: 'IDEA' }) }),
    );
  });

  it("répond 201 même si GitHub est down — l'appel GitHub n'est pas dans le handler", async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    vi.mocked(prismaMock.feedback.count).mockResolvedValue(0 as never);
    vi.mocked(prismaMock.feedback.create).mockResolvedValue(mockFeedback({ kind: 'BUG' }) as never);

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'BUG', message: 'Ça casse', context: { route: '/focus' } });

    expect(res.status).toBe(201);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('joint le context transmis (route, userAgent) pour un bug', async () => {
    vi.mocked(prismaMock.feedback.count).mockResolvedValue(0 as never);
    vi.mocked(prismaMock.feedback.create).mockResolvedValue(mockFeedback({ kind: 'BUG' }) as never);

    await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'BUG',
        message: 'Ça casse',
        context: { route: '/focus', userAgent: 'Mozilla/5.0' },
      });

    expect(vi.mocked(prismaMock.feedback.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ context: { route: '/focus', userAgent: 'Mozilla/5.0' } }),
      }),
    );
  });

  it('429 au 11e écho de la journée', async () => {
    vi.mocked(prismaMock.feedback.count).mockResolvedValue(10 as never);

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'PRAISE', message: 'Bravo !' });

    expect(res.status).toBe(429);
    expect(prismaMock.feedback.create).not.toHaveBeenCalled();
  });

  it('400 si message vide', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'IDEA', message: '' });

    expect(res.status).toBe(400);
  });

  it('400 si message dépasse 2000 caractères', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'IDEA', message: 'a'.repeat(2001) });

    expect(res.status).toBe(400);
  });

  it('400 si kind invalide', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'WRONG', message: 'test' });

    expect(res.status).toBe(400);
  });

  it('401 sans token', async () => {
    const res = await request(app).post('/api/feedback').send({ kind: 'IDEA', message: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/feedback/mine', () => {
  it("retourne les échos de l'utilisateur avec leur githubIssueUrl", async () => {
    const feedbacks = [
      mockFeedback({ id: 'fb-1', githubIssueUrl: 'https://github.com/acme/oracle/issues/1' }),
    ];
    vi.mocked(prismaMock.feedback.findMany).mockResolvedValue(feedbacks as never);

    const res = await request(app)
      .get('/api/feedback/mine')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].githubIssueUrl).toBe('https://github.com/acme/oracle/issues/1');
    expect(vi.mocked(prismaMock.feedback.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
  });

  it('401 sans token', async () => {
    const res = await request(app).get('/api/feedback/mine');
    expect(res.status).toBe(401);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
