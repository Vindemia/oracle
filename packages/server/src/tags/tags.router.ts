import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

const colorRegex = /^#[0-9a-fA-F]{6}$/;

const createSchema = z.object({
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().regex(colorRegex),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  color: z.string().regex(colorRegex).optional(),
});

router.get('/', async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(tags);
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

  const { name, icon, color } = parsed.data;

  try {
    const existing = await prisma.tag.findUnique({
      where: { userId_name: { userId: req.userId, name } },
    });
    if (existing) {
      res.status(409).json({ error: 'Tag name already exists' });
      return;
    }

    const tag = await prisma.tag.create({
      data: { name, icon, color, userId: req.userId },
    });
    res.status(201).json(tag);
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
    const existing = await prisma.tag.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    const { name, icon, color } = parsed.data;

    if (name !== undefined && name !== existing.name) {
      const duplicate = await prisma.tag.findUnique({
        where: { userId_name: { userId: req.userId, name } },
      });
      if (duplicate) {
        res.status(409).json({ error: 'Tag name already exists' });
        return;
      }
    }

    const tag = await prisma.tag.update({
      where: { id: req.params['id'] },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    });
    res.json(tag);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.tag.findUnique({ where: { id: req.params['id'] } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    await prisma.tag.delete({ where: { id: req.params['id'] } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
