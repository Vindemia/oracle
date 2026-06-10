import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateAccessToken } from '../auth/auth.service.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
    },
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');

const USER_ID = 'user-1';
const FEED_TOKEN = 'feed-token-abc';
const token = generateAccessToken(USER_ID);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/calendar/:token', () => {
  it('renvoie un VCALENDAR avec les visions planifiées du propriétaire', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ id: USER_ID } as never);
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([
      {
        id: 'task-1',
        title: 'Consulter les astres, vite',
        notes: 'Ligne 1\nLigne 2',
        plannedFor: new Date('2026-06-15T09:00:00.000Z'),
      },
    ] as never);

    const res = await request(app).get(`/api/calendar/${FEED_TOKEN}.ics`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('X-WR-CALNAME:Oracle');
    expect(res.text).toContain('UID:task-1@oracle');
    expect(res.text).toContain('DTSTART:20260615T090000Z');
    // Virgules et retours à la ligne échappés (RFC 5545)
    expect(res.text).toContain('SUMMARY:Consulter les astres\\, vite');
    expect(res.text).toContain('DESCRIPTION:Ligne 1\\nLigne 2');

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { calendarFeedToken: FEED_TOKEN } }),
    );
    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, status: 'ACTIVE' }),
      }),
    );
  });

  it("fonctionne aussi sans l'extension .ics", async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ id: USER_ID } as never);
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([] as never);

    const res = await request(app).get(`/api/calendar/${FEED_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('END:VCALENDAR');
  });

  it('404 si token inconnu', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null as never);

    const res = await request(app).get('/api/calendar/token-inconnu.ics');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/calendar/feed-token', () => {
  it('401 sans authentification', async () => {
    const res = await request(app).post('/api/calendar/feed-token');
    expect(res.status).toBe(401);
  });

  it('génère et enregistre un nouveau token', async () => {
    vi.mocked(prismaMock.user.update).mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/calendar/feed-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect((res.body.token as string).length).toBeGreaterThanOrEqual(24);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { calendarFeedToken: res.body.token },
      }),
    );
  });
});

describe('GET /api/calendar/feed-token', () => {
  it('retourne le token courant', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      calendarFeedToken: FEED_TOKEN,
    } as never);

    const res = await request(app)
      .get('/api/calendar/feed-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.token).toBe(FEED_TOKEN);
  });

  it('401 sans authentification', async () => {
    const res = await request(app).get('/api/calendar/feed-token');
    expect(res.status).toBe(401);
  });
});
