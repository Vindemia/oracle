import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Les variables VAPID doivent exister avant l'évaluation de push.service.js
process.env['VAPID_PUBLIC_KEY'] = 'test-public-key';
process.env['VAPID_PRIVATE_KEY'] = 'test-private-key';
process.env['VAPID_SUBJECT'] = 'mailto:test@oracle.dev';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');
const { default: app } = await import('../app.js');
const { generateAccessToken } = await import('../auth/auth.service.js');

const USER_ID = 'user-1';
const token = generateAccessToken(USER_ID);

const PREFS = {
  remindersEnabled: true,
  reminderLeadMinutes: 15,
  dailySummaryEnabled: true,
  dailySummaryHour: 8,
  staleRemindersEnabled: false,
  staleDays: 7,
  timezone: 'Europe/Paris',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/push/vapid-public-key', () => {
  it('retourne la clé publique', async () => {
    const res = await request(app)
      .get('/api/push/vapid-public-key')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBe('test-public-key');
  });

  it('401 sans token', async () => {
    const res = await request(app).get('/api/push/vapid-public-key');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/push/subscribe', () => {
  it('201 et upsert sur endpoint', async () => {
    vi.mocked(prismaMock.pushSubscription.upsert).mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        endpoint: 'https://push.example.com/sub/abc',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      });

    expect(res.status).toBe(201);
    expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: 'https://push.example.com/sub/abc' },
        create: expect.objectContaining({ userId: USER_ID, p256dh: 'p256dh-key' }),
      }),
    );
  });

  it('400 si endpoint invalide', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'pas-une-url', keys: { p256dh: 'a', auth: 'b' } });

    expect(res.status).toBe(400);
  });

  it('400 si keys manquantes', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example.com/sub/abc' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/push/subscribe', () => {
  it("204 et suppression limitée à l'utilisateur", async () => {
    vi.mocked(prismaMock.pushSubscription.deleteMany).mockResolvedValue({ count: 1 } as never);

    const res = await request(app)
      .delete('/api/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example.com/sub/abc' });

    expect(res.status).toBe(204);
    expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.com/sub/abc', userId: USER_ID },
    });
  });
});

describe('GET /api/push/prefs', () => {
  it('retourne les préférences', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(PREFS as never);

    const res = await request(app)
      .get('/api/push/prefs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reminderLeadMinutes).toBe(15);
  });
});

describe('PATCH /api/push/prefs', () => {
  it('met à jour uniquement les champs fournis', async () => {
    vi.mocked(prismaMock.user.update).mockResolvedValue({ ...PREFS, dailySummaryHour: 7 } as never);

    const res = await request(app)
      .patch('/api/push/prefs')
      .set('Authorization', `Bearer ${token}`)
      .send({ dailySummaryHour: 7 });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { dailySummaryHour: 7 },
      }),
    );
  });

  it('400 si heure hors bornes', async () => {
    const res = await request(app)
      .patch('/api/push/prefs')
      .set('Authorization', `Bearer ${token}`)
      .send({ dailySummaryHour: 24 });

    expect(res.status).toBe(400);
  });

  it('400 si timezone invalide', async () => {
    const res = await request(app)
      .patch('/api/push/prefs')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Pas/Un_Fuseau' });

    expect(res.status).toBe(400);
  });
});
