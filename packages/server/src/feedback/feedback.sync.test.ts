import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  default: {
    feedback: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const { default: prismaMock } = await import('../lib/prisma.js');

const ORIGINAL_ENV = { ...process.env };

// Forme minimale des options passées à `fetch` par le tick — évite de
// référencer l'identifiant global DOM `RequestInit`, non reconnu par la
// règle ESLint `no-undef` de ce projet.
interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function mockFeedback(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fb-1',
    kind: 'BUG',
    message: 'Quelque chose cloche vraiment beaucoup ici et là aussi, dans le détail',
    context: { route: '/focus', userAgent: 'Mozilla/5.0', version: '1.4.0' },
    githubIssueUrl: null,
    syncedAt: null,
    createdAt: new Date('2026-07-08T10:00:00.000Z'),
    userId: 'user-1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    GITHUB_FEEDBACK_TOKEN: 'ghp_test_token',
    GITHUB_FEEDBACK_REPO: 'acme/oracle',
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('tickFeedbackSync', () => {
  it("crée l'issue GitHub avec les bons labels et marque syncedAt (claim atomique)", async () => {
    const { tickFeedbackSync } = await import('./feedback.sync.js');
    const feedback = mockFeedback();
    vi.mocked(prismaMock.feedback.findMany).mockResolvedValue([feedback] as never);
    vi.mocked(prismaMock.feedback.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ displayName: 'Luna' } as never);
    vi.mocked(prismaMock.feedback.update).mockResolvedValue(feedback as never);

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ html_url: 'https://github.com/acme/oracle/issues/42' }),
    } as Response);

    await tickFeedbackSync();

    expect(prismaMock.feedback.updateMany).toHaveBeenCalledWith({
      where: { id: 'fb-1', syncedAt: null },
      data: { syncedAt: expect.any(Date) as Date },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/acme/oracle/issues',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, options] = fetchSpy.mock.calls[0] as [string, FetchInit];
    const payload = JSON.parse(options.body as string) as {
      labels: string[];
      title: string;
      body: string;
    };
    expect(payload.labels).toEqual(['echo', 'bug']);
    expect(payload.title.startsWith('[écho]')).toBe(true);
    expect(payload.body).toContain('Luna');

    expect(prismaMock.feedback.update).toHaveBeenCalledWith({
      where: { id: 'fb-1' },
      data: { githubIssueUrl: 'https://github.com/acme/oracle/issues/42' },
    });
  });

  it('applique le bon label selon le kind (idea, praise)', async () => {
    const { tickFeedbackSync } = await import('./feedback.sync.js');
    const feedback = mockFeedback({ kind: 'PRAISE' });
    vi.mocked(prismaMock.feedback.findMany).mockResolvedValue([feedback] as never);
    vi.mocked(prismaMock.feedback.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ displayName: 'Luna' } as never);
    vi.mocked(prismaMock.feedback.update).mockResolvedValue(feedback as never);

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ html_url: 'https://github.com/acme/oracle/issues/43' }),
    } as Response);

    await tickFeedbackSync();

    const [, options] = fetchSpy.mock.calls[0] as [string, FetchInit];
    const payload = JSON.parse(options.body as string) as { labels: string[] };
    expect(payload.labels).toEqual(['echo', 'praise']);
  });

  it("ne traite pas deux fois un écho déjà réclamé (claim atomique, pas de doublon)", async () => {
    const { tickFeedbackSync } = await import('./feedback.sync.js');
    const feedback = mockFeedback();
    vi.mocked(prismaMock.feedback.findMany).mockResolvedValue([feedback] as never);
    vi.mocked(prismaMock.feedback.updateMany).mockResolvedValue({ count: 0 } as never);
    const fetchSpy = vi.spyOn(global, 'fetch');

    await tickFeedbackSync();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prismaMock.feedback.update).not.toHaveBeenCalled();
  });

  it("libère le claim (syncedAt: null) si l'appel GitHub échoue — retry au tick suivant", async () => {
    const { tickFeedbackSync } = await import('./feedback.sync.js');
    const feedback = mockFeedback();
    vi.mocked(prismaMock.feedback.findMany).mockResolvedValue([feedback] as never);
    vi.mocked(prismaMock.feedback.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ displayName: 'Luna' } as never);
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response);
    vi.mocked(prismaMock.feedback.update).mockResolvedValue(feedback as never);

    await tickFeedbackSync();

    expect(prismaMock.feedback.update).toHaveBeenCalledWith({
      where: { id: 'fb-1' },
      data: { syncedAt: null },
    });
  });

  it('libère aussi le claim en cas d\'exception réseau (fetch rejette)', async () => {
    const { tickFeedbackSync } = await import('./feedback.sync.js');
    const feedback = mockFeedback();
    vi.mocked(prismaMock.feedback.findMany).mockResolvedValue([feedback] as never);
    vi.mocked(prismaMock.feedback.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ displayName: 'Luna' } as never);
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    vi.mocked(prismaMock.feedback.update).mockResolvedValue(feedback as never);

    await tickFeedbackSync();

    expect(prismaMock.feedback.update).toHaveBeenCalledWith({
      where: { id: 'fb-1' },
      data: { syncedAt: null },
    });
  });

  it("n'écrit jamais l'email dans le body — utilise displayName ou un pseudonyme", async () => {
    const { tickFeedbackSync } = await import('./feedback.sync.js');
    const feedback = mockFeedback();
    vi.mocked(prismaMock.feedback.findMany).mockResolvedValue([feedback] as never);
    vi.mocked(prismaMock.feedback.updateMany).mockResolvedValue({ count: 1 } as never);
    // Pas de displayName exploitable → pseudonyme dérivé, jamais l'email.
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prismaMock.feedback.update).mockResolvedValue(feedback as never);

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ html_url: 'https://github.com/acme/oracle/issues/44' }),
    } as Response);

    await tickFeedbackSync();

    const [, options] = fetchSpy.mock.calls[0] as [string, FetchInit];
    const payload = JSON.parse(options.body as string) as { body: string };
    expect(payload.body).not.toMatch(/@/);
    expect(payload.body).toContain('user-1'.slice(0, 8));
  });

  it('sans variables GITHUB_FEEDBACK_* : warning au boot, aucun appel, aucun crash', async () => {
    process.env['GITHUB_FEEDBACK_TOKEN'] = '';
    process.env['GITHUB_FEEDBACK_REPO'] = '';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { tickFeedbackSync } = await import('./feedback.sync.js');

    expect(warnSpy).toHaveBeenCalled();

    await expect(tickFeedbackSync()).resolves.toBeUndefined();
    expect(prismaMock.feedback.findMany).not.toHaveBeenCalled();
  });
});
