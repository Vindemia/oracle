import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { generateAccessToken } from '../auth/auth.service.js';

vi.mock('../lib/prisma.js', () => ({
  default: {
    tag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    taskTag: {
      deleteMany: vi.fn(),
    },
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const token = generateAccessToken(USER_ID);

function mockTag(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tag-1',
    name: 'Perso',
    icon: '🌙',
    color: '#7c3aed',
    isDefault: false,
    deletedAt: null,
    createdAt: new Date(),
    userId: USER_ID,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/tags', () => {
  it('retourne les 5 tags par défaut après register', async () => {
    const tags = Array.from({ length: 5 }, (_, i) => {
      const idx = String(i);
      return mockTag({ id: `tag-${idx}`, name: `Tag ${idx}`, isDefault: true });
    });
    vi.mocked(prismaMock.tag.findMany).mockResolvedValue(tags as never);

    const res = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(vi.mocked(prismaMock.tag.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID }),
      }),
    );
  });

  it('401 sans token', async () => {
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/tags', () => {
  it('crée un tag et retourne 201', async () => {
    const tag = mockTag();
    vi.mocked(prismaMock.tag.findUnique).mockResolvedValue(null);
    vi.mocked(prismaMock.tag.create).mockResolvedValue(tag as never);

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Perso', icon: '🌙', color: '#7c3aed' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Perso');
  });

  it('409 si deux tags avec le même nom', async () => {
    const existing = mockTag();
    vi.mocked(prismaMock.tag.findUnique).mockResolvedValue(existing as never);

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Perso', icon: '⭐', color: '#ff0000' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Tag name already exists');
    expect(prismaMock.tag.create).not.toHaveBeenCalled();
  });

  it('400 si color invalide', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test', icon: '⭐', color: 'rouge' });

    expect(res.status).toBe(400);
  });

  it('400 si name vide', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', icon: '⭐', color: '#ff0000' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/tags/:id', () => {
  it('modifie le nom d\'un tag', async () => {
    const existing = mockTag();
    const updated = mockTag({ name: 'Nouveau nom' });
    vi.mocked(prismaMock.tag.findUnique)
      .mockResolvedValueOnce(existing as never) // vérification ownership
      .mockResolvedValueOnce(null); // vérification unicité
    vi.mocked(prismaMock.tag.update).mockResolvedValue(updated as never);

    const res = await request(app)
      .patch('/api/tags/tag-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nouveau nom' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nouveau nom');
  });

  it('409 si le nouveau nom existe déjà', async () => {
    const existing = mockTag();
    const duplicate = mockTag({ id: 'tag-2', name: 'Boulot' });
    vi.mocked(prismaMock.tag.findUnique)
      .mockResolvedValueOnce(existing as never) // vérification ownership
      .mockResolvedValueOnce(duplicate as never); // vérification unicité

    const res = await request(app)
      .patch('/api/tags/tag-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Boulot' });

    expect(res.status).toBe(409);
    expect(prismaMock.tag.update).not.toHaveBeenCalled();
  });

  it('404 si tag appartient à un autre utilisateur', async () => {
    const otherTag = mockTag({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.tag.findUnique).mockResolvedValue(otherTag as never);

    const res = await request(app)
      .patch('/api/tags/tag-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nouveau nom' });

    expect(res.status).toBe(404);
    expect(prismaMock.tag.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/tags/:id', () => {
  it('supprime le tag et retourne 204 sans supprimer les tâches', async () => {
    const existing = mockTag();
    vi.mocked(prismaMock.tag.findUnique).mockResolvedValue(existing as never);
    vi.mocked(prismaMock.taskTag.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prismaMock.tag.update).mockResolvedValue({ ...existing, deletedAt: new Date() } as never);

    const res = await request(app)
      .delete('/api/tags/tag-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    // Soft-delete : conserve les associations des visions accomplies/éliminées
    expect(vi.mocked(prismaMock.tag.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tag-1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });

  it('404 si tag d\'un autre utilisateur', async () => {
    const otherTag = mockTag({ userId: OTHER_USER_ID });
    vi.mocked(prismaMock.tag.findUnique).mockResolvedValue(otherTag as never);

    const res = await request(app)
      .delete('/api/tags/tag-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(prismaMock.tag.delete).not.toHaveBeenCalled();
  });
});
