import prisma from '../lib/prisma.js';
import { promoteDueTasks } from '../tasks/promotion.js';
import { isPushConfigured, sendToUser } from '../push/push.service.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Horizon de requête : le plus grand délai de rappel autorisé (cf. prefsSchema).
const MAX_LEAD_MINUTES = 1440;

interface LocalParts {
  dateKey: string;
  hour: number;
}

/** Date (YYYY-MM-DD) et heure locales dans le fuseau de l'utilisateur. */
function localParts(date: Date, timeZone: string): LocalParts {
  let fmt: Intl.DateTimeFormat;
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  } as const;
  try {
    fmt = new Intl.DateTimeFormat('fr-CA', { timeZone, ...options });
  } catch {
    fmt = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', ...options });
  }
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

function localTime(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}

/**
 * Rappels d'échéance : présage pour chaque vision dont `plannedFor` tombe
 * dans la fenêtre [now, now + reminderLeadMinutes] de son propriétaire.
 * `reminderSentAt` garantit un envoi unique par vision.
 */
export async function tickReminders(now = new Date()): Promise<void> {
  const horizon = new Date(now.getTime() + MAX_LEAD_MINUTES * MINUTE);
  const candidates = await prisma.task.findMany({
    where: {
      status: 'ACTIVE',
      reminderSentAt: null,
      plannedFor: { gte: now, lte: horizon },
      user: { remindersEnabled: true, pushSubscriptions: { some: {} } },
    },
    select: {
      id: true,
      title: true,
      plannedFor: true,
      userId: true,
      user: { select: { reminderLeadMinutes: true, timezone: true } },
    },
  });

  for (const task of candidates) {
    if (!task.plannedFor) continue;
    const lead = task.user.reminderLeadMinutes * MINUTE;
    if (task.plannedFor.getTime() - now.getTime() > lead) continue;

    await sendToUser(task.userId, {
      title: "L'Oracle murmure…",
      body: `La vision « ${task.title} » approche (${localTime(task.plannedFor, task.user.timezone)}).`,
      url: '/',
      tag: `reminder-${task.id}`,
    });
    await prisma.task.update({
      where: { id: task.id },
      data: { reminderSentAt: now },
    });
  }
}

/**
 * Résumé matinal + relance des visions négligées. Déclenchés une fois par jour
 * (date locale mémorisée sur l'utilisateur) dès que l'heure locale atteint
 * `dailySummaryHour`.
 */
export async function tickDigests(now = new Date()): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      pushSubscriptions: { some: {} },
      OR: [{ dailySummaryEnabled: true }, { staleRemindersEnabled: true }],
    },
    select: {
      id: true,
      timezone: true,
      dailySummaryEnabled: true,
      dailySummaryHour: true,
      lastDailySummaryOn: true,
      staleRemindersEnabled: true,
      staleDays: true,
      lastStaleRemindersOn: true,
    },
  });

  for (const user of users) {
    const { dateKey, hour } = localParts(now, user.timezone);
    if (hour < user.dailySummaryHour) continue;

    if (user.dailySummaryEnabled && user.lastDailySummaryOn !== dateKey) {
      await sendDailySummary(user.id, user.timezone, dateKey, now);
      await prisma.user.update({
        where: { id: user.id },
        data: { lastDailySummaryOn: dateKey },
      });
    }

    if (user.staleRemindersEnabled && user.lastStaleRemindersOn !== dateKey) {
      await sendStaleReminder(user.id, user.staleDays, now);
      await prisma.user.update({
        where: { id: user.id },
        data: { lastStaleRemindersOn: dateKey },
      });
    }
  }
}

async function sendDailySummary(
  userId: string,
  timeZone: string,
  dateKey: string,
  now: Date,
): Promise<void> {
  const fireCount = await prisma.task.count({
    where: { userId, status: 'ACTIVE', quadrant: 'FIRE' },
  });

  // Visions planifiées « aujourd'hui » au sens du fuseau de l'utilisateur :
  // fenêtre large en UTC puis filtrage sur la date locale.
  const planned = await prisma.task.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      plannedFor: {
        gte: new Date(now.getTime() - DAY - 2 * 60 * MINUTE),
        lte: new Date(now.getTime() + DAY + 2 * 60 * MINUTE),
      },
    },
    select: { plannedFor: true },
  });
  const plannedToday = planned.filter(
    (t) => t.plannedFor !== null && localParts(t.plannedFor, timeZone).dateKey === dateKey,
  ).length;

  if (fireCount === 0 && plannedToday === 0) return;

  const pieces: string[] = [];
  if (fireCount > 0) {
    pieces.push(`${fireCount.toString()} vision${fireCount > 1 ? 's' : ''} dans le Brasier`);
  }
  if (plannedToday > 0) {
    pieces.push(
      `${plannedToday.toString()} vision${plannedToday > 1 ? 's' : ''} planifiée${plannedToday > 1 ? 's' : ''} aujourd'hui`,
    );
  }

  await sendToUser(userId, {
    title: 'Les présages du jour',
    body: pieces.join(' · ') + '.',
    url: '/focus',
    tag: 'daily-summary',
  });
}

async function sendStaleReminder(userId: string, staleDays: number, now: Date): Promise<void> {
  const threshold = new Date(now.getTime() - staleDays * DAY);
  const staleCount = await prisma.task.count({
    where: { userId, status: 'ACTIVE', updatedAt: { lt: threshold } },
  });
  if (staleCount === 0) return;

  await sendToUser(userId, {
    title: 'Des visions sommeillent…',
    body: `${staleCount.toString()} vision${staleCount > 1 ? 's' : ''} attend${staleCount > 1 ? 'ent' : ''} dans la brume depuis plus de ${staleDays.toString()} jours.`,
    url: '/',
    tag: 'stale-reminder',
  });
}

function runSafe(tick: () => Promise<void>): void {
  tick().catch((err: unknown) => {
    console.error('[scheduler] Tick en échec', err);
  });
}

/** Démarre les ticks périodiques. À appeler une seule fois, après app.listen. */
export function startScheduler(): void {
  if (!isPushConfigured) {
    console.warn('[scheduler] Push non configuré — seuls les ticks de promotion tourneront');
  }
  setInterval(() => {
    runSafe(async () => {
      await promoteDueTasks();
      await tickReminders();
    });
  }, MINUTE);
  setInterval(() => {
    runSafe(tickDigests);
  }, 10 * MINUTE);
  // Rattrapage immédiat au démarrage (anti-doublon par date locale).
  runSafe(tickDigests);
  console.log('[scheduler] Démarré (rappels: 1 min, présages quotidiens: 10 min)');
}
