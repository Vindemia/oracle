import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { calcQuadrant, serialize, taskInclude } from '../tasks/tasks.router.js';

const router = Router();

router.use(authMiddleware);

const createSchema = z.object({
  text: z.string().min(1).max(500),
});

const revealSchema = z.object({
  urgent: z.boolean(),
  important: z.boolean(),
  tagIds: z.array(z.uuid()).optional(),
});

function serializeWhisper(whisper: { id: string; text: string; createdAt: Date }) {
  return {
    id: whisper.id,
    text: whisper.text,
    createdAt: whisper.createdAt.toISOString(),
  };
}

router.get('/', async (req, res) => {
  try {
    const whispers = await prisma.whisper.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(whispers.map(serializeWhisper));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    const whisper = await prisma.whisper.create({
      data: { text: parsed.data.text, userId: req.userId },
    });
    res.status(201).json(serializeWhisper(whisper));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.whisper.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Whisper not found' });
      return;
    }

    await prisma.whisper.delete({ where: { id: req.params['id'] } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/reveal', async (req, res) => {
  const parsed = revealSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    const existing = await prisma.whisper.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Whisper not found' });
      return;
    }

    const { urgent, important, tagIds } = parsed.data;
    const quadrant = calcQuadrant(urgent, important);

    const maxPos = await prisma.task.aggregate({
      where: { userId: req.userId, quadrant },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    const [task] = await prisma.$transaction([
      prisma.task.create({
        data: {
          title: existing.text,
          urgent,
          important,
          quadrant,
          position,
          userId: req.userId,
          ...(tagIds?.length
            ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } }
            : {}),
        },
        include: taskInclude,
      }),
      prisma.whisper.delete({ where: { id: existing.id } }),
    ]);

    res.status(201).json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
