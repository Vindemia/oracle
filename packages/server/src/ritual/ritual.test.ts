import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateAccessToken } from '../auth/auth.service.js';
import { todayKey } from '../lib/dates.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    whisper: {
      count: vi.fn(),
    },
    activityDay: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');

const USER_ID = 'user-1';
const TIMEZONE = 'Europe/Paris';
const token = generateAccessToken(USER_ID);
const TODAY = todayKey(TIMEZONE);

function mockTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Vision test',
    urgent: false,
    important: true,
    quadrant: 'STARS',
    status: 'ACTIVE',
    position: 0,
    userId: USER_ID,
    notes: null,
    plannedFor: null,
    starredOn: null,
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
  vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
    timezone: TIMEZONE,
    lastRitualOn: null,
  } as never);
  vi.mocked(prismaMock.whisper.count).mockResolvedValue(0 as never);
  vi.mocked(prismaMock.task.findMany).mockResolvedValue([] as never);
  vi.mocked(prismaMock.$transaction).mockResolvedValue([] as never);
});

describe('GET /api/ritual/status', () => {
  it('ritualDoneToday=false tant que le rituel du jour n\'est pas accompli', async () => {
    const res = await request(app).get('/api/ritual/status').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ritualDoneToday).toBe(false);
  });

  it('ritualDoneToday=true si lastRitualOn est la dateKey du jour', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      timezone: TIMEZONE,
      lastRitualOn: TODAY,
    } as never);

    const res = await request(app).get('/api/ritual/status').set('Authorization', `Bearer ${token}`);

    expect(res.body.ritualDoneToday).toBe(true);
  });

  it('ritualDoneToday=false si le dernier rituel date d\'un autre jour', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      timezone: TIMEZONE,
      lastRitualOn: '2020-01-01',
    } as never);

    const res = await request(app).get('/api/ritual/status').set('Authorization', `Bearer ${token}`);

    expect(res.body.ritualDoneToday).toBe(false);
  });

  it('ordonne les suggestions FIRE → STARS planifiées aujourd\'hui → STARS', async () => {
    // Volontairement dans le désordre : c'est le rang qui doit trancher, pas l'ordre d'arrivée.
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([
      mockTask({ id: 'stars', quadrant: 'STARS', position: 0 }),
      mockTask({ id: 'planned', quadrant: 'STARS', position: 5, plannedFor: new Date() }),
      mockTask({ id: 'fire', quadrant: 'FIRE', position: 9 }),
    ] as never);

    const res = await request(app).get('/api/ritual/status').set('Authorization', `Bearer ${token}`);

    const suggestions = res.body.suggestions as { id: string }[];
    expect(suggestions.map((t) => t.id)).toEqual(['fire', 'planned', 'stars']);
  });

  it('ne propose pas plus de 6 candidates', async () => {
    vi.mocked(prismaMock.task.findMany).mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => mockTask({ id: `task-${i.toString()}`, position: i })) as never,
    );

    const res = await request(app).get('/api/ritual/status').set('Authorization', `Bearer ${token}`);

    expect(res.body.suggestions).toHaveLength(6);
  });

  it('starredToday ne retient que les étoiles de la dateKey du jour', async () => {
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([
      mockTask({ id: 'aujourdhui', starredOn: TODAY }),
      mockTask({ id: 'hier', starredOn: '2020-01-01' }),
      mockTask({ id: 'jamais' }),
    ] as never);

    const res = await request(app).get('/api/ritual/status').set('Authorization', `Bearer ${token}`);

    const starred = res.body.starredToday as { id: string }[];
    expect(starred.map((t) => t.id)).toEqual(['aujourdhui']);
  });

  it('remonte le nombre de murmures en attente', async () => {
    vi.mocked(prismaMock.whisper.count).mockResolvedValue(3 as never);

    const res = await request(app).get('/api/ritual/status').set('Authorization', `Bearer ${token}`);

    expect(res.body.whisperCount).toBe(3);
  });

  it('401 sans token', async () => {
    const res = await request(app).get('/api/ritual/status');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/ritual/complete', () => {
  it('pose lastRitualOn et crée le jour actif', async () => {
    const res = await request(app)
      .post('/api/ritual/complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ritualDoneToday: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { lastRitualOn: TODAY },
    });
    expect(prismaMock.activityDay.upsert).toHaveBeenCalledWith({
      where: { userId_dateKey: { userId: USER_ID, dateKey: TODAY } },
      create: { userId: USER_ID, dateKey: TODAY },
      update: {},
    });
  });

  it('rejoué le même jour, ne crée pas un second jour actif', async () => {
    // L'upsert est la garantie : même clé composite, `update: {}` ne duplique rien.
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      timezone: TIMEZONE,
      lastRitualOn: TODAY,
    } as never);

    const res = await request(app)
      .post('/api/ritual/complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(prismaMock.activityDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_dateKey: { userId: USER_ID, dateKey: TODAY } },
        update: {},
      }),
    );
  });

  it('401 sans token', async () => {
    const res = await request(app).post('/api/ritual/complete');
    expect(res.status).toBe(401);
  });
});
