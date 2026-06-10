import prisma from '../lib/prisma.js';

/**
 * Promeut vers FIRE les tâches actives dont l'échéance (`plannedFor`) est passée.
 * Sans `userId`, traite tous les utilisateurs (appel scheduler) ; avec `userId`,
 * se limite à celui-ci (filet paresseux au GET /tasks).
 */
export async function promoteDueTasks(userId?: string): Promise<void> {
  const now = new Date();
  const due = await prisma.task.findMany({
    where: {
      ...(userId !== undefined ? { userId } : {}),
      status: 'ACTIVE',
      plannedFor: { lte: now },
      NOT: { quadrant: 'FIRE' },
    },
    select: { id: true, userId: true },
  });

  if (due.length === 0) return;

  const byUser = new Map<string, string[]>();
  for (const task of due) {
    const ids = byUser.get(task.userId) ?? [];
    ids.push(task.id);
    byUser.set(task.userId, ids);
  }

  for (const [ownerId, ids] of byUser) {
    const agg = await prisma.task.aggregate({
      where: { userId: ownerId, quadrant: 'FIRE', status: 'ACTIVE' },
      _max: { position: true },
    });
    const basePos = (agg._max.position ?? -1) + 1;
    await prisma.$transaction(
      ids.map((id, i) =>
        prisma.task.update({
          where: { id },
          data: { urgent: true, important: true, quadrant: 'FIRE', position: basePos + i },
        }),
      ),
    );
  }
}
