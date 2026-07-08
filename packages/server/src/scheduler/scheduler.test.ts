import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  default: {
    task: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../push/push.service.js', () => ({
  isPushConfigured: true,
  getVapidPublicKey: () => 'test-key',
  sendToUser: vi.fn(),
}));

const { default: prismaMock } = await import('../lib/prisma.js');
const { sendToUser } = await import('../push/push.service.js');
const { tickReminders, tickDigests } = await import('./scheduler.js');

const NOW = new Date('2026-06-10T10:00:00.000Z');

function dateKeyParis(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    timezone: 'Europe/Paris',
    dailySummaryEnabled: false,
    dailySummaryHour: 8,
    lastDailySummaryOn: null,
    staleRemindersEnabled: false,
    staleDays: 7,
    lastStaleRemindersOn: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tickReminders', () => {
  it("envoie le présage quand l'échéance entre dans la fenêtre du lead", async () => {
    const task = {
      id: 'task-1',
      title: 'Consulter les astres',
      plannedFor: new Date(NOW.getTime() + 10 * 60_000),
      userId: 'user-1',
      user: { reminderLeadMinutes: 15, timezone: 'Europe/Paris' },
    };
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([task] as never);
    vi.mocked(prismaMock.task.updateMany).mockResolvedValue({ count: 1 } as never);

    await tickReminders(NOW);

    expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', reminderSentAt: null },
      data: { reminderSentAt: NOW },
    });
    expect(sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ tag: 'reminder-task-1' }),
    );
  });

  it("n'envoie rien si l'échéance est au-delà du lead de l'utilisateur", async () => {
    const task = {
      id: 'task-1',
      title: 'Vision lointaine',
      plannedFor: new Date(NOW.getTime() + 30 * 60_000),
      userId: 'user-1',
      user: { reminderLeadMinutes: 15, timezone: 'Europe/Paris' },
    };
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([task] as never);

    await tickReminders(NOW);

    expect(sendToUser).not.toHaveBeenCalled();
    expect(prismaMock.task.updateMany).not.toHaveBeenCalled();
  });

  it("envoie le présage pour une échéance passée pendant un downtime (lookback)", async () => {
    const task = {
      id: 'task-1',
      title: 'Vision manquée',
      plannedFor: new Date(NOW.getTime() - 5 * 60_000),
      userId: 'user-1',
      user: { reminderLeadMinutes: 15, timezone: 'Europe/Paris' },
    };
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([task] as never);
    vi.mocked(prismaMock.task.updateMany).mockResolvedValue({ count: 1 } as never);

    await tickReminders(NOW);

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plannedFor: { gte: new Date(NOW.getTime() - 10 * 60_000), lte: expect.any(Date) },
        }),
      }),
    );
    expect(sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ tag: 'reminder-task-1' }),
    );
  });

  it("n'envoie pas si un autre réplica a déjà réclamé le rappel (claim atomique)", async () => {
    const task = {
      id: 'task-1',
      title: 'Consulter les astres',
      plannedFor: new Date(NOW.getTime() + 10 * 60_000),
      userId: 'user-1',
      user: { reminderLeadMinutes: 15, timezone: 'Europe/Paris' },
    };
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([task] as never);
    vi.mocked(prismaMock.task.updateMany).mockResolvedValue({ count: 0 } as never);

    await tickReminders(NOW);

    expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', reminderSentAt: null },
      data: { reminderSentAt: NOW },
    });
    expect(sendToUser).not.toHaveBeenCalled();
  });
});

describe('tickDigests — résumé matinal', () => {
  it("envoie le résumé et mémorise la date locale d'envoi", async () => {
    const user = mockUser({ dailySummaryEnabled: true, dailySummaryHour: 8 });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);
    vi.mocked(prismaMock.task.count).mockResolvedValue(2 as never);
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([] as never);
    vi.mocked(prismaMock.user.updateMany).mockResolvedValue({ count: 1 } as never);

    await tickDigests(NOW); // 12h heure de Paris en juin → >= 8h

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', NOT: { lastDailySummaryOn: dateKeyParis(NOW) } },
      data: { lastDailySummaryOn: dateKeyParis(NOW) },
    });
    expect(sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ tag: 'daily-summary' }),
    );
  });

  it("n'envoie pas deux fois le même jour (anti-doublon)", async () => {
    const user = mockUser({
      dailySummaryEnabled: true,
      lastDailySummaryOn: dateKeyParis(NOW),
    });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);

    await tickDigests(NOW);

    expect(sendToUser).not.toHaveBeenCalled();
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("n'envoie rien avant l'heure locale choisie", async () => {
    const user = mockUser({ dailySummaryEnabled: true, dailySummaryHour: 20 });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);

    await tickDigests(NOW); // 12h heure de Paris < 20h

    expect(sendToUser).not.toHaveBeenCalled();
  });

  it("marque la date sans présage quand il n'y a rien à résumer", async () => {
    const user = mockUser({ dailySummaryEnabled: true });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);
    vi.mocked(prismaMock.task.count).mockResolvedValue(0 as never);
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([] as never);
    vi.mocked(prismaMock.user.updateMany).mockResolvedValue({ count: 1 } as never);

    await tickDigests(NOW);

    expect(sendToUser).not.toHaveBeenCalled();
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastDailySummaryOn: dateKeyParis(NOW) } }),
    );
  });

  it("n'envoie pas si un autre réplica a déjà réclamé le résumé du jour (claim atomique)", async () => {
    const user = mockUser({ dailySummaryEnabled: true, dailySummaryHour: 8 });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);
    vi.mocked(prismaMock.user.updateMany).mockResolvedValue({ count: 0 } as never);

    await tickDigests(NOW);

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', NOT: { lastDailySummaryOn: dateKeyParis(NOW) } },
      data: { lastDailySummaryOn: dateKeyParis(NOW) },
    });
    expect(sendToUser).not.toHaveBeenCalled();
    expect(prismaMock.task.count).not.toHaveBeenCalled();
  });
});

describe('tickDigests — purge des tokens de reset', () => {
  it('purge les tokens de réinitialisation de mot de passe expirés', async () => {
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([] as never);

    await tickDigests(NOW);

    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: NOW } },
    });
  });
});

describe('tickDigests — relance des négligées', () => {
  it('envoie la relance quand des visions sommeillent', async () => {
    const user = mockUser({ staleRemindersEnabled: true, staleDays: 7 });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);
    vi.mocked(prismaMock.task.count).mockResolvedValue(3 as never);
    vi.mocked(prismaMock.user.updateMany).mockResolvedValue({ count: 1 } as never);

    await tickDigests(NOW);

    expect(sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ tag: 'stale-reminder' }),
    );
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', NOT: { lastStaleRemindersOn: dateKeyParis(NOW) } },
      data: { lastStaleRemindersOn: dateKeyParis(NOW) },
    });
  });

  it("n'envoie rien si aucune vision négligée", async () => {
    const user = mockUser({ staleRemindersEnabled: true });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);
    vi.mocked(prismaMock.task.count).mockResolvedValue(0 as never);
    vi.mocked(prismaMock.user.updateMany).mockResolvedValue({ count: 1 } as never);

    await tickDigests(NOW);

    expect(sendToUser).not.toHaveBeenCalled();
  });

  it("n'envoie pas si un autre réplica a déjà réclamé la relance (claim atomique)", async () => {
    const user = mockUser({ staleRemindersEnabled: true, staleDays: 7 });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);
    vi.mocked(prismaMock.user.updateMany).mockResolvedValue({ count: 0 } as never);

    await tickDigests(NOW);

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', NOT: { lastStaleRemindersOn: dateKeyParis(NOW) } },
      data: { lastStaleRemindersOn: dateKeyParis(NOW) },
    });
    expect(sendToUser).not.toHaveBeenCalled();
    expect(prismaMock.task.count).not.toHaveBeenCalled();
  });
});
