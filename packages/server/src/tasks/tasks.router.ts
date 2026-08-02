import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { promoteDueTasks } from './promotion.js';
import type { Prisma, Quadrant } from '@prisma/client';

const router = Router();

router.use(authMiddleware);

const reorderSchema = z.array(
  z.object({ id: z.uuid(), position: z.number().int().min(0) }),
).min(1);

export const taskInclude = {
  tags: { include: { tag: true } },
  steps: { orderBy: { position: 'asc' } },
} as const;

export type TaskResult = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

// Fragments de vision (v3-01) : max 10 par tâche, au-delà on invite à découper la vision.
const MAX_STEPS_PER_TASK = 10;

export function serialize(task: TaskResult) {
  return {
    ...task,
    tags: task.tags.map((tt) => tt.tag),
    steps: task.steps.map((s) => ({ id: s.id, title: s.title, done: s.done, position: s.position })),
    plannedFor: task.plannedFor?.toISOString() ?? null,
    notes: task.notes ?? null,
  };
}

export function calcQuadrant(urgent: boolean, important: boolean): Quadrant {
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
  plannedFor: z.iso.datetime(),
});

const createStepSchema = z.object({
  title: z.string().min(1).max(200),
});

const updateStepSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  done: z.boolean().optional(),
});

router.get('/', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  const { status, quadrant, tagId } = parsed.data;

  try {
    // Filet paresseux : le scheduler couvre les utilisateurs inactifs,
    // ce GET garantit une vue à jour sans attendre le prochain tick.
    await promoteDueTasks(req.userId);

    const tasks = await prisma.task.findMany({
      where: {
        userId: req.userId,
        ...(status !== undefined ? { status } : {}),
        ...(quadrant !== undefined ? { quadrant } : {}),
        ...(tagId !== undefined ? { tags: { some: { tagId } } } : {}),
      },
      include: taskInclude,
      orderBy: [{ quadrant: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
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
    const maxPos = await prisma.task.aggregate({
      where: { userId: req.userId, quadrant },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    const task = await prisma.task.create({
      data: {
        title,
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
    });
    res.status(201).json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reorder', async (req, res, next) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  const items = parsed.data;
  const ids = items.map((item) => item.id);

  try {
    const tasks = await prisma.task.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true },
    });

    const notOwned = tasks.find((t) => t.userId !== req.userId);
    if (notOwned) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const notFound = ids.find((id) => !tasks.some((t) => t.id === id));
    if (notFound) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.task.update({
          where: { id: item.id },
          data: { position: item.position },
        }),
      ),
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
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
    const quadrantChanged = urgent !== undefined || important !== undefined;
    const quadrant = quadrantChanged ? calcQuadrant(newUrgent, newImportant) : undefined;

    let newPosition: number | undefined;
    if (quadrantChanged && quadrant !== undefined && quadrant !== existing.quadrant) {
      const maxPos = await prisma.task.aggregate({
        where: { userId: req.userId, quadrant },
        _max: { position: true },
      });
      newPosition = (maxPos._max.position ?? -1) + 1;
    }

    const task = await prisma.task.update({
      where: { id: req.params['id'] },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(urgent !== undefined ? { urgent } : {}),
        ...(important !== undefined ? { important } : {}),
        ...(quadrant !== undefined ? { quadrant } : {}),
        ...(newPosition !== undefined ? { position: newPosition } : {}),
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
      data: { plannedFor: plannedDate, reminderSentAt: null },
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
      data: { plannedFor: null, reminderSentAt: null },
      include: taskInclude,
    });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/steps', async (req, res) => {
  const parsed = createStepSchema.safeParse(req.body);
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

    const steps = await prisma.taskStep.findMany({ where: { taskId: existing.id } });
    if (steps.length >= MAX_STEPS_PER_TASK) {
      res.status(400).json({
        error: 'Cette vision compte déjà 10 fragments — envisage de la découper en plusieurs visions.',
      });
      return;
    }
    const position = steps.reduce((max, s) => Math.max(max, s.position), -1) + 1;

    await prisma.taskStep.create({
      data: { title: parsed.data.title, position, taskId: existing.id },
    });

    const task = await prisma.task.findUniqueOrThrow({ where: { id: existing.id }, include: taskInclude });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/steps/:stepId', async (req, res) => {
  const parsed = updateStepSchema.safeParse(req.body);
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

    const step = await prisma.taskStep.findUnique({ where: { id: req.params['stepId'] } });
    if (!step || step.taskId !== existing.id) {
      res.status(404).json({ error: 'Step not found' });
      return;
    }

    const { title, done } = parsed.data;
    await prisma.taskStep.update({
      where: { id: step.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(done !== undefined ? { done } : {}),
      },
    });

    const task = await prisma.task.findUniqueOrThrow({ where: { id: existing.id }, include: taskInclude });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/steps/:stepId', async (req, res) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const step = await prisma.taskStep.findUnique({ where: { id: req.params['stepId'] } });
    if (!step || step.taskId !== existing.id) {
      res.status(404).json({ error: 'Step not found' });
      return;
    }

    await prisma.taskStep.delete({ where: { id: step.id } });

    const task = await prisma.task.findUniqueOrThrow({ where: { id: existing.id }, include: taskInclude });
    res.json(serialize(task));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
