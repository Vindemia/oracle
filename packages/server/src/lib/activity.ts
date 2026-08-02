import prisma from './prisma.js';
import { todayKey } from './dates.js';

/** dateKey du jour dans le fuseau de l'utilisateur. */
export async function userTodayKey(userId: string, now = new Date()): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return todayKey(user?.timezone ?? 'Europe/Paris', now);
}

/**
 * Marque le jour comme actif (v3-03). Purement additif : on n'enregistre que
 * la présence, jamais l'absence — pas de streak à casser.
 */
export async function markActiveDay(userId: string, now = new Date()): Promise<void> {
  const dateKey = await userTodayKey(userId, now);
  await prisma.activityDay.upsert({
    where: { userId_dateKey: { userId, dateKey } },
    create: { userId, dateKey },
    update: {},
  });
}

/**
 * Variante à greffer sur une action métier (compléter, éliminer, révéler) :
 * un jour actif non enregistré ne doit jamais faire échouer l'action elle-même,
 * qui est déjà commitée en base quand on arrive ici.
 */
export function markActiveDaySafe(userId: string, now = new Date()): void {
  markActiveDay(userId, now).catch((err: unknown) => {
    console.error('[activity] Jour actif non enregistré', err);
  });
}
