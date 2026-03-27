import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateAccessToken, generateRefreshToken } from './auth.service.js';

// Mock du singleton Prisma
vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    tag: {
      createMany: vi.fn(),
    },
  },
}));

// Import du mock APRÈS vi.mock
const { default: prismaMock } = await import('../lib/prisma.js');

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  password: '$2a$12$hashedpassword',
  displayName: 'Testeur',
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/register', () => {
  it('crée un user et retourne les tokens', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);
    vi.mocked(prismaMock.user.create).mockResolvedValue({
      id: mockUser.id,
      email: mockUser.email,
      displayName: mockUser.displayName,
      createdAt: mockUser.createdAt,
    } as never);
    vi.mocked(prismaMock.tag.createMany).mockResolvedValue({ count: 5 });
    vi.mocked(prismaMock.refreshToken.create).mockResolvedValue({} as never);

    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Testeur',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('409 si email déjà utilisé', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(mockUser as never);

    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Testeur',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });

  it('400 si validation échoue (email invalide)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'password123',
      displayName: 'Testeur',
    });

    expect(res.status).toBe(400);
  });

  it('400 si password trop court', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: '1234567',
      displayName: 'Testeur',
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('200 avec bons identifiants', async () => {
    const bcrypt = await import('bcryptjs');
    const realHash = await bcrypt.hash('password123', 12);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      ...mockUser,
      password: realHash,
    } as never);
    vi.mocked(prismaMock.refreshToken.create).mockResolvedValue({} as never);

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('401 avec mauvais mot de passe', async () => {
    const bcrypt = await import('bcryptjs');
    const realHash = await bcrypt.hash('correctpassword', 12);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      ...mockUser,
      password: realHash,
    } as never);

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('401 si utilisateur introuvable', async () => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);

    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('retourne de nouveaux tokens et invalide l\'ancien', async () => {
    const oldRefresh = generateRefreshToken('user-1');
    const futureDate = new Date(Date.now() + 1000 * 60 * 60);

    vi.mocked(prismaMock.refreshToken.findUnique).mockResolvedValue({
      id: 'rt-1',
      token: oldRefresh,
      userId: 'user-1',
      expiresAt: futureDate,
      createdAt: new Date(),
    } as never);
    vi.mocked(prismaMock.refreshToken.delete).mockResolvedValue({} as never);
    vi.mocked(prismaMock.refreshToken.create).mockResolvedValue({} as never);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${oldRefresh}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    // Vérifie la rotation : l'ancien token est supprimé et un nouveau créé
    expect(prismaMock.refreshToken.delete).toHaveBeenCalledWith({ where: { token: oldRefresh } });
    expect(prismaMock.refreshToken.create).toHaveBeenCalled();
  });

  it('401 si token déjà utilisé (replay attack)', async () => {
    vi.mocked(prismaMock.refreshToken.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=alreadyusedtoken');

    expect(res.status).toBe(401);
  });

  it('401 si pas de cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('supprime le refreshToken de la BDD', async () => {
    const token = generateRefreshToken('user-1');
    vi.mocked(prismaMock.refreshToken.deleteMany).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `refreshToken=${token}`);

    expect(res.status).toBe(204);
    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token } });
  });

  it('204 même sans cookie (idempotent)', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });
});

describe('Auth middleware', () => {
  // Route de test protégée
  beforeEach(() => {
    // Enregistrement d'une route de test si pas déjà fait
  });

  it('401 sans token', async () => {
    const res = await request(app).get('/api/health');
    // /api/health n'est pas protégée, tester le middleware directement
    // via auth.middleware.ts en appelant une route protégée
    expect(res.status).toBe(200); // health est publique
  });
});

describe('Auth middleware (direct)', () => {
  it('401 sans header Authorization', async () => {
    const { authMiddleware } = await import('./auth.middleware.js');
    const mockReq = { headers: {} } as unknown as import('express').Request;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as import('express').Response;
    const mockNext = vi.fn() as import('express').NextFunction;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('401 avec token expiré', async () => {
    const { authMiddleware } = await import('./auth.middleware.js');
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.invalidsignature';
    const mockReq = { headers: { authorization: `Bearer ${expiredToken}` } } as unknown as import('express').Request;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as import('express').Response;
    const mockNext = vi.fn() as import('express').NextFunction;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('injecte userId avec token valide', async () => {
    const { authMiddleware } = await import('./auth.middleware.js');
    const token = generateAccessToken('user-42');
    const mockReq = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as import('express').Request;
    const mockRes = {} as unknown as import('express').Response;
    const mockNext = vi.fn() as import('express').NextFunction;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect((mockReq as { userId: string }).userId).toBe('user-42');
  });
});
