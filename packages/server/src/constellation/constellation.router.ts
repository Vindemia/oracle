import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { serialize, taskInclude } from '../tasks/tasks.router.js';
import { localParts, localMonthRange } from '../lib/dates.js';

const router = Router();

router.use(authMiddleware);

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month doit être au format YYYY-MM').optional(),
});

/**
 * Constellation (v3-05) — récompense cumulative qui ne régresse jamais : tout
 * est dérivé d'ActivityDay (v3-03) et des tâches DONE/ELIMINATED du mois
 * local demandé (fuseau utilisateur, jamais UTC).
 */
router.get('/', async (req, res) => {
  const parsed = monthQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { timezone: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const monthKey = parsed.data.month ?? localParts(new Date(), user.timezone).dateKey.slice(0, 7);
    const { start, end } = localMonthRange(monthKey, user.timezone);

    const [activeDaysTotal, activeDaysThisMonth, completedTasks, eliminatedThisMonthCount] = await Promise.all([
      prisma.activityDay.count({ where: { userId: req.userId } }),
      prisma.activityDay.findMany({
        where: { userId: req.userId, dateKey: { startsWith: monthKey } },
        orderBy: { dateKey: 'asc' },
        select: { dateKey: true },
      }),
      prisma.task.findMany({
        where: { userId: req.userId, status: 'DONE', completedAt: { gte: start, lt: end } },
        include: taskInclude,
        orderBy: { completedAt: 'asc' },
      }),
      prisma.task.count({
        where: { userId: req.userId, status: 'ELIMINATED', completedAt: { gte: start, lt: end } },
      }),
    ]);

    res.json({
      activeDaysTotal,
      activeDaysThisMonth: activeDaysThisMonth.map((d) => d.dateKey),
      completedThisMonth: completedTasks.map(serialize).map((t) => ({
        id: t.id,
        title: t.title,
        completedAt: t.completedAt,
        quadrant: t.quadrant,
      })),
      eliminatedThisMonthCount,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
