import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';

// Mock du singleton Prisma
vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    refreshToken: {
      deleteMany: vi.fn(),
    },
  },
}));

// Mock de l'envoi d'email : on vérifie les appels sans dépendre d'un vrai SMTP.
vi.mock('../mail/mail.service.js', () => ({
  isMailConfigured: false,
  sendPasswordResetEmail: vi.fn(),
}));

// Imports du mock APRÈS vi.mock
const { default: prismaMock } = await import('../lib/prisma.js');
const { sendPasswordResetEmail } = await import('../mail/mail.service.js');
const { default: app } = await import('../app.js');

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  password: '$2a$12$hashedpassword',
  displayName: 'Testeuse',
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/forgot-password', () => {
  it('204 pour un email connu : crée un token et envoie un email', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prismaMock.passwordResetToken.count).mockResolvedValue(0 as never);
    vi.mocked(prismaMock.passwordResetToken.create).mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: mockUser.email });

    expect(res.status).toBe(204);
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('204 pour un email inconnu (anti-énumération), sans créer de token ni envoyer d\'email', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(204);
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('rate limit silencieux : au-delà de 3 demandes/heure, toujours 204 sans nouvel envoi', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prismaMock.passwordResetToken.count).mockResolvedValue(3 as never);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: mockUser.email });

    expect(res.status).toBe(204);
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('400 si validation échoue (email invalide)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('le hash stocké en base ne correspond jamais au token en clair envoyé par email', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prismaMock.passwordResetToken.count).mockResolvedValue(0 as never);
    vi.mocked(prismaMock.passwordResetToken.create).mockResolvedValue({} as never);

    await request(app).post('/api/auth/forgot-password').send({ email: mockUser.email });

    const createCall = vi.mocked(prismaMock.passwordResetToken.create).mock.calls[0]?.[0] as {
      data: { tokenHash: string };
    };
    const emailCall = vi.mocked(sendPasswordResetEmail).mock.calls[0] as [string, string];
    const resetUrl = emailCall[1];
    const rawToken = new URL(resetUrl).searchParams.get('token') ?? '';

    expect(rawToken).not.toHaveLength(0);
    expect(createCall.data.tokenHash).not.toBe(rawToken);
    expect(createCall.data.tokenHash).toBe(
      crypto.createHash('sha256').update(rawToken).digest('hex'),
    );
  });
});

describe('POST /api/auth/reset-password', () => {
  it('400 générique si le token est inconnu', async () => {
    vi.mocked(prismaMock.passwordResetToken.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'unknown-token', newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Ce lien a expiré ou a déjà servi.');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('400 générique si le token a déjà été utilisé', async () => {
    vi.mocked(prismaMock.passwordResetToken.findUnique).mockResolvedValue({
      id: 'prt-1',
      tokenHash: 'x',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
      createdAt: new Date(),
    } as never);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'used-token', newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Ce lien a expiré ou a déjà servi.');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('400 générique si le token est expiré', async () => {
    vi.mocked(prismaMock.passwordResetToken.findUnique).mockResolvedValue({
      id: 'prt-1',
      tokenHash: 'x',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      createdAt: new Date(),
    } as never);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'expired-token', newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Ce lien a expiré ou a déjà servi.');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('token valide : met à jour le mot de passe, pose usedAt et révoque tous les refresh tokens', async () => {
    vi.mocked(prismaMock.passwordResetToken.findUnique).mockResolvedValue({
      id: 'prt-1',
      tokenHash: 'x',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    } as never);
    vi.mocked(prismaMock.passwordResetToken.update).mockResolvedValue({} as never);
    vi.mocked(prismaMock.user.update).mockResolvedValue({} as never);
    vi.mocked(prismaMock.refreshToken.deleteMany).mockResolvedValue({ count: 2 } as never);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'valid-token', newPassword: 'newpassword123' });

    expect(res.status).toBe(204);
    expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'prt-1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('400 si validation échoue (mot de passe trop court)', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'some-token', newPassword: '1234567' });

    expect(res.status).toBe(400);
  });

  it('400 si le token est manquant', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
  });
});
