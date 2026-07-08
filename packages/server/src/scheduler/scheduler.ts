import prisma from '../lib/prisma.js';
import { promoteDueTasks } from '../tasks/promotion.js';
import { isPushConfigured, sendToUser } from '../push/push.service.js';
import { MAX_LEAD_MINUTES } from '../push/push.router.js';
import { tickFeedbackSync } from '../feedback/feedback.sync.js';
import { purgeExpiredPasswordResetTokens } from '../auth/auth.service.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Lookback de requête : couvre les rappels dont l'échéance est passée pendant
// un downtime (arrêt du process, déploiement…) pour ne pas les perdre.
const LOOKBACK_MINUTES = 10;

interface LocalParts {
  dateKey: string;
  hour: number;
}

/** Exécute `fn` dans le fuseau demandé, avec repli sur Europe/Paris si invalide. */
function withTimezoneFallback<T>(timeZone: string, fn: (tz: string) => T): T {
  try {
    return fn(timeZone);
  } catch {
    return fn('Europe/Paris');
  }
}

/** Date (YYYY-MM-DD) et heure locales dans le fuseau de l'utilisateur. */
function localParts(date: Date, timeZone: string): LocalParts {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  } as const;
  return withTimezoneFallback(timeZone, (tz) => {
    const fmt = new Intl.DateTimeFormat('fr-CA', { timeZone: tz, ...options });
    const parts = fmt.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '00';
    return {
      dateKey: `${get('year')}-${get('month')}-${get('day')}`,
      hour: Number(get('hour')),
    };
  });
}

function localTime(date: Date, timeZone: string): string {
  return withTimezoneFallback(timeZone, (tz) =>
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
      date,
    ),
  );
}

/**
 * Rappels d'échéance : présage pour chaque vision dont `plannedFor` tombe
 * dans la fenêtre [now, now + reminderLeadMinutes] de son propriétaire.
 * `reminderSentAt` garantit un envoi unique par vision.
 */
export async function tickReminders(now = new Date()): Promise<void> {
  const horizon = new Date(now.getTime() + MAX_LEAD_MINUTES * MINUTE);
  const lookback = new Date(now.getTime() - LOOKBACK_MINUTES * MINUTE);
  const candidates = await prisma.task.findMany({
    where: {
      status: 'ACTIVE',
      reminderSentAt: null,
      plannedFor: { gte: lookback, lte: horizon },
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
    const diff = task.plannedFor.getTime() - now.getTime();
    // Trop loin dans le futur (hors fenêtre de lead) : on ne l'envoie pas
    // encore. Une échéance déjà passée (diff négatif, rattrapée grâce au
    // lookback) doit au contraire toujours déclencher l'envoi.
    if (diff > lead) continue;

    // Claim atomique : n'envoie que si on a été le seul à réussir à marquer
    // ce rappel comme envoyé (protège contre le double-envoi multi-réplica).
    const claimed = await prisma.task.updateMany({
      where: { id: task.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) continue;

    await sendToUser(task.userId, {
      title: "L'Oracle murmure…",
      body: `La vision « ${task.title} » approche (${localTime(task.plannedFor, task.user.timezone)}).`,
      url: '/',
      tag: `reminder-${task.id}`,
    });
  }
}

/**
 * Résumé matinal + relance des visions négligées. Déclenchés une fois par jour
 * (date locale mémorisée sur l'utilisateur) dès que l'heure locale atteint
 * `dailySummaryHour`.
 */
export async function tickDigests(now = new Date()): Promise<void> {
  // Purge des tokens de réinitialisation de mot de passe expirés — sans
  // impact sur la logique de résumé quotidien ci-dessous, greffée ici pour
  // réutiliser le tick quotidien existant plutôt que d'en ajouter un.
  await purgeExpiredPasswordResetTokens(prisma, now);

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
      // Claim atomique avant l'envoi : protège contre le double-envoi si
      // plusieurs réplicas du scheduler tournent en parallèle.
      const claimed = await prisma.user.updateMany({
        where: { id: user.id, NOT: { lastDailySummaryOn: dateKey } },
        data: { lastDailySummaryOn: dateKey },
      });
      if (claimed.count === 1) {
        await sendDailySummary(user.id, user.timezone, dateKey, now);
      }
    }

    if (user.staleRemindersEnabled && user.lastStaleRemindersOn !== dateKey) {
      const claimed = await prisma.user.updateMany({
        where: { id: user.id, NOT: { lastStaleRemindersOn: dateKey } },
        data: { lastStaleRemindersOn: dateKey },
      });
      if (claimed.count === 1) {
        await sendStaleReminder(user.id, user.staleDays, now);
      }
    }
  }
}

async function sendDailySummary(
  userId: string,
  timeZone: string,
  dateKey: string,
  now: Date,
): Promise<void> {
  // Visions planifiées « aujourd'hui » au sens du fuseau de l'utilisateur :
  // fenêtre large en UTC puis filtrage sur la date locale.
  const [fireCount, planned] = await Promise.all([
    prisma.task.count({
      where: { userId, status: 'ACTIVE', quadrant: 'FIRE' },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        plannedFor: {
          gte: new Date(now.getTime() - DAY - 2 * 60 * MINUTE),
          lte: new Date(now.getTime() + DAY + 2 * 60 * MINUTE),
        },
      },
      select: { plannedFor: true },
    }),
  ]);
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
  setInterval(() => {
    runSafe(tickFeedbackSync);
  }, 5 * MINUTE);
  // Rattrapage immédiat au démarrage (anti-doublon par date locale).
  runSafe(tickDigests);
  console.log(
    '[scheduler] Démarré (rappels: 1 min, présages quotidiens: 10 min, échos GitHub: 5 min)',
  );
}
