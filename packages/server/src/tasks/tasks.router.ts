import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { Prisma, Quadrant } from '@prisma/client';

const router = Router();

router.use(authMiddleware);

const taskInclude = {
  tags: { include: { tag: true } },
} as const;

type TaskResult = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

function serialize(task: TaskResult) {
  return {
    ...task,
    tags: task.tags.map((tt) => tt.tag),
    plannedFor: task.plannedFor?.toISOString() ?? null,
    notes: task.notes ?? null,
  };
}

function calcQuadrant(urgent: boolean, important: boolean): Quadrant {
  if (urgent && important) return 'FIRE';
  if (!urgent && important) return 'STARS';
  if (urgent && !important) return 'WIND';
  return 'MIST';
}

const listQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'DONE', 'ELIMINATED']).optional(),
  quadrant: z.enum(['FIRE', 'STARS', 'WIND', 'MIST']).optional(),
  tagId: z.uuid().optional(),
});

const createSchema = z.object({
  title: z.string().min(1),
  urgent: z.boolean(),
  important: z.boolean(),
  tagIds: z.array(z.uuid()).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  urgent: z.boolean().optional(),
  important: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'DONE', 'ELIMINATED']).optional(),
  tagIds: z.array(z.uuid()).optional(),
});

const planSchema = z.object({
  plannedFor: z.string().datetime(),
});

router.get('/', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  const { status, quadrant, tagId } = parsed.data;

  try {
    const tasks = await prisma.task.findMany({
      where: {
        userId: req.userId,
        ...(status !== undefined ? { status } : {}),
        ...(quadrant !== undefined ? { quadrant } : {}),
        ...(tagId !== undefined ? { tags: { some: { tagId } } } : {}),
      },
      include: taskInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(tasks.map(serialize));
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

  const { title, urgent, important, tagIds } = parsed.data;
  const quadrant = calcQuadrant(urgent, important);

  try {
    const task = await prisma.task.create({
      data: {
        title,
        urgent,
        important,
        quadrant,
        userId: req.userId,
        ...(tagIds?.length
          ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      include: taskInclude,
    });
    res.status(201).json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const { title, urgent, important, status, tagIds } = parsed.data;

    const newUrgent = urgent ?? existing.urgent;
    const newImportant = important ?? existing.important;
    const quadrant =
      urgent !== undefined || important !== undefined
        ? calcQuadrant(newUrgent, newImportant)
        : undefined;

    const task = await prisma.task.update({
      where: { id: req.params['id'] },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(urgent !== undefined ? { urgent } : {}),
        ...(important !== undefined ? { important } : {}),
        ...(quadrant !== undefined ? { quadrant } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(tagIds !== undefined
          ? { tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      include: taskInclude,
    });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    await prisma.task.delete({ where: { id: req.params['id'] } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = await prisma.task.update({
      where: { id: req.params['id'] },
      data: { status: 'DONE', completedAt: new Date() },
      include: taskInclude,
    });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/eliminate', async (req, res) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = await prisma.task.update({
      where: { id: req.params['id'] },
      data: { status: 'ELIMINATED', completedAt: new Date() },
      include: taskInclude,
    });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/reactivate', async (req, res) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = await prisma.task.update({
      where: { id: req.params['id'] },
      data: { status: 'ACTIVE', completedAt: null },
      include: taskInclude,
    });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/plan', async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  const plannedDate = new Date(parsed.data.plannedFor);
  if (plannedDate <= new Date()) {
    res.status(400).json({ error: 'plannedFor must be in the future' });
    return;
  }

  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = await prisma.task.update({
      where: { id: req.params['id'] },
      data: { plannedFor: plannedDate },
      include: taskInclude,
    });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/unplan', async (req, res) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = await prisma.task.update({
      where: { id: req.params['id'] },
      data: { plannedFor: null },
      include: taskInclude,
    });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
