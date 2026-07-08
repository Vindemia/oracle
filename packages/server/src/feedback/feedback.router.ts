import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { AppError, createFeedback } from './feedback.service.js';

const router = Router();

router.use(authMiddleware);

const createSchema = z.object({
  kind: z.enum(['PRAISE', 'IDEA', 'BUG']),
  message: z.string().min(1).max(2000),
  context: z.record(z.string(), z.unknown()).optional(),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    const feedback = await createFeedback(prisma, req.userId, parsed.data);
    // 201 immédiat — la synchronisation GitHub est asynchrone (scheduler),
    // l'utilisatrice n'attend jamais cet appel réseau.
    res.status(201).json(feedback);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(429).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/mine', async (req, res) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(feedbacks);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
