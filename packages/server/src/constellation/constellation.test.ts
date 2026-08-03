import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateAccessToken } from '../auth/auth.service.js';
import { localMonthRange } from '../lib/dates.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    activityDay: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');

const USER_ID = 'user-1';
const TIMEZONE = 'Europe/Paris';
const token = generateAccessToken(USER_ID);

function mockTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Vision test',
    urgent: false,
    important: true,
    quadrant: 'STARS',
    status: 'DONE',
    position: 0,
    userId: USER_ID,
    notes: null,
    plannedFor: null,
    starredOn: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date('2026-07-15T10:00:00.000Z'),
    tags: [],
    steps: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ timezone: TIMEZONE } as never);
  vi.mocked(prismaMock.activityDay.count).mockResolvedValue(0 as never);
  vi.mocked(prismaMock.activityDay.findMany).mockResolvedValue([] as never);
  vi.mocked(prismaMock.task.findMany).mockResolvedValue([] as never);
  vi.mocked(prismaMock.task.count).mockResolvedValue(0 as never);
});

describe('GET /api/constellation', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/constellation');
    expect(res.status).toBe(401);
  });

  it('400 si ?month= est mal formé', async () => {
    const res = await request(app)
      .get('/api/constellation?month=not-a-month')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('interroge la fenêtre du mois local courant par défaut (fuseau utilisateur)', async () => {
    // Mois courant figé par le mock horloge — on le lit depuis la réponse
    // elle-même n'est pas fiable ici, donc on fixe une horloge de test.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T12:00:00.000Z'));

    await request(app).get('/api/constellation').set('Authorization', `Bearer ${token}`);

    const { start, end } = localMonthRange('2026-07', TIMEZONE);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, status: 'DONE', completedAt: { gte: start, lt: end } },
      include: expect.anything() as unknown,
      orderBy: { completedAt: 'asc' },
    });
    expect(prismaMock.activityDay.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, dateKey: { startsWith: '2026-07' } },
      orderBy: { dateKey: 'asc' },
      select: { dateKey: true },
    });
    expect(prismaMock.task.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, status: 'ELIMINATED', completedAt: { gte: start, lt: end } },
    });

    vi.useRealTimers();
  });

  it('?month= navigue dans le passé — interroge la fenêtre du mois demandé', async () => {
    await request(app)
      .get('/api/constellation?month=2025-12')
      .set('Authorization', `Bearer ${token}`);

    const { start, end } = localMonthRange('2025-12', TIMEZONE);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, status: 'DONE', completedAt: { gte: start, lt: end } },
      }),
    );
    expect(prismaMock.activityDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, dateKey: { startsWith: '2025-12' } },
      }),
    );
  });

  it('mois vide → tableaux vides, pas d\'erreur', async () => {
    const res = await request(app)
      .get('/api/constellation?month=2020-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      activeDaysTotal: 0,
      activeDaysThisMonth: [],
      completedThisMonth: [],
      eliminatedThisMonthCount: 0,
    });
  });

  it('agrège jours actifs (total à vie + mois) et complétions du mois', async () => {
    vi.mocked(prismaMock.activityDay.count).mockResolvedValue(47 as never);
    vi.mocked(prismaMock.activityDay.findMany).mockResolvedValue([
      { dateKey: '2026-07-01' },
      { dateKey: '2026-07-03' },
    ] as never);
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([mockTask()] as never);
    vi.mocked(prismaMock.task.count).mockResolvedValue(3 as never);

    const res = await request(app)
      .get('/api/constellation?month=2026-07')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.activeDaysTotal).toBe(47);
    expect(res.body.activeDaysThisMonth).toEqual(['2026-07-01', '2026-07-03']);
    expect(res.body.completedThisMonth).toEqual([
      { id: 'task-1', title: 'Vision test', completedAt: '2026-07-15T10:00:00.000Z', quadrant: 'STARS' },
    ]);
    expect(res.body.eliminatedThisMonthCount).toBe(3);
  });

  it('404 si utilisateur introuvable', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null as never);
    const res = await request(app).get('/api/constellation').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
