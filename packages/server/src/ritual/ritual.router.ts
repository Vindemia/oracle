import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { serialize, taskInclude, type TaskResult } from '../tasks/tasks.router.js';
import { localParts, todayKey } from '../lib/dates.js';

const router = Router();

router.use(authMiddleware);

// Rituel de l'Aube (v3-03) : moins de 2 minutes, donc peu de choix à faire.
// Au-delà de 6 candidates, on retombe dans la paralysie qu'on cherche à éviter.
const MAX_SUGGESTIONS = 6;

/**
 * Candidates aux Étoiles du jour, dans l'ordre où l'Oracle les propose :
 * le Brasier d'abord (urgent + important), puis les visions planifiées
 * aujourd'hui, puis le reste des Étoiles (important non urgent).
 */
function rankSuggestions(tasks: TaskResult[], timezone: string, dateKey: string): TaskResult[] {
  const rank = (t: TaskResult): number => {
    if (t.quadrant === 'FIRE') return 0;
    if (t.plannedFor !== null && localParts(t.plannedFor, timezone).dateKey === dateKey) return 1;
    return 2;
  };
  return [...tasks]
    .sort((a, b) => rank(a) - rank(b) || a.position - b.position)
    .slice(0, MAX_SUGGESTIONS);
}

router.get('/status', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { timezone: true, lastRitualOn: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const dateKey = todayKey(user.timezone);
    const [whisperCount, candidates] = await Promise.all([
      prisma.whisper.count({ where: { userId: req.userId } }),
      prisma.task.findMany({
        where: {
          userId: req.userId,
          status: 'ACTIVE',
          quadrant: { in: ['FIRE', 'STARS'] },
        },
        include: taskInclude,
        orderBy: { position: 'asc' },
      }),
    ]);

    res.json({
      ritualDoneToday: user.lastRitualOn === dateKey,
      // Distingue « jamais fait de rituel » (null) de « fait un autre jour » —
      // consommé par le client pour détecter un tout premier lancement (v3-15).
      lastRitualOn: user.lastRitualOn,
      whisperCount,
      starredToday: candidates.filter((t) => t.starredOn === dateKey).map(serialize),
      suggestions: rankSuggestions(candidates, user.timezone, dateKey).map(serialize),
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { timezone: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const dateKey = todayKey(user.timezone);
    // Idempotent : rejouer le rituel le même jour ne crée pas un second jour actif.
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { lastRitualOn: dateKey } }),
      prisma.activityDay.upsert({
        where: { userId_dateKey: { userId: req.userId, dateKey } },
        create: { userId: req.userId, dateKey },
        update: {},
      }),
    ]);

    res.json({ ritualDoneToday: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
