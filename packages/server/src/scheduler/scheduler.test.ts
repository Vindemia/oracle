import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  default: {
    task: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      update: vi.fn(),
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
    vi.mocked(prismaMock.task.update).mockResolvedValue({} as never);

    await tickReminders(NOW);

    expect(sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ tag: 'reminder-task-1' }),
    );
    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { reminderSentAt: NOW },
    });
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
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });
});

describe('tickDigests — résumé matinal', () => {
  it("envoie le résumé et mémorise la date locale d'envoi", async () => {
    const user = mockUser({ dailySummaryEnabled: true, dailySummaryHour: 8 });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);
    vi.mocked(prismaMock.task.count).mockResolvedValue(2 as never);
    vi.mocked(prismaMock.task.findMany).mockResolvedValue([] as never);
    vi.mocked(prismaMock.user.update).mockResolvedValue({} as never);

    await tickDigests(NOW); // 12h heure de Paris en juin → >= 8h

    expect(sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ tag: 'daily-summary' }),
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastDailySummaryOn: dateKeyParis(NOW) },
    });
  });

  it("n'envoie pas deux fois le même jour (anti-doublon)", async () => {
    const user = mockUser({
      dailySummaryEnabled: true,
      lastDailySummaryOn: dateKeyParis(NOW),
    });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);

    await tickDigests(NOW);

    expect(sendToUser).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
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
    vi.mocked(prismaMock.user.update).mockResolvedValue({} as never);

    await tickDigests(NOW);

    expect(sendToUser).not.toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastDailySummaryOn: dateKeyParis(NOW) } }),
    );
  });
});

describe('tickDigests — relance des négligées', () => {
  it('envoie la relance quand des visions sommeillent', async () => {
    const user = mockUser({ staleRemindersEnabled: true, staleDays: 7 });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);
    vi.mocked(prismaMock.task.count).mockResolvedValue(3 as never);
    vi.mocked(prismaMock.user.update).mockResolvedValue({} as never);

    await tickDigests(NOW);

    expect(sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ tag: 'stale-reminder' }),
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastStaleRemindersOn: dateKeyParis(NOW) },
    });
  });

  it("n'envoie rien si aucune vision négligée", async () => {
    const user = mockUser({ staleRemindersEnabled: true });
    vi.mocked(prismaMock.user.findMany).mockResolvedValue([user] as never);
    vi.mocked(prismaMock.task.count).mockResolvedValue(0 as never);
    vi.mocked(prismaMock.user.update).mockResolvedValue({} as never);

    await tickDigests(NOW);

    expect(sendToUser).not.toHaveBeenCalled();
  });
});
