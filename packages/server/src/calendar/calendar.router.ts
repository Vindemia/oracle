import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { buildCalendar } from '../lib/ical.js';

const router = Router();

// Lecture du token courant — pour afficher l'URL d'abonnement dans Settings.
router.get('/feed-token', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { calendarFeedToken: true },
    });
    res.json({ token: user?.calendarFeedToken ?? null });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Génère (ou régénère — révocation de l'ancien lien) le token du flux.
router.post('/feed-token', authMiddleware, async (req, res) => {
  try {
    const token = randomBytes(24).toString('base64url');
    await prisma.user.update({
      where: { id: req.userId },
      data: { calendarFeedToken: token },
    });
    res.status(201).json({ token });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Flux public : les clients agenda (Google/Apple/Outlook) ne portent pas de JWT,
// l'authentification repose sur le token opaque contenu dans l'URL.
router.get('/:token', async (req, res) => {
  const token = req.params['token'].replace(/\.ics$/, '');

  try {
    const user = await prisma.user.findUnique({
      where: { calendarFeedToken: token },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const tasks = await prisma.task.findMany({
      where: { userId: user.id, status: 'ACTIVE', plannedFor: { not: null } },
      select: { id: true, title: true, notes: true, plannedFor: true },
      orderBy: { plannedFor: 'asc' },
    });

    const events = tasks
      .filter((t): t is typeof t & { plannedFor: Date } => t.plannedFor !== null)
      .map((t) => ({ id: t.id, title: t.title, notes: t.notes, plannedFor: t.plannedFor }));

    res
      .set('Content-Type', 'text/calendar; charset=utf-8')
      .set('Content-Disposition', 'inline; filename="oracle.ics"')
      .set('Cache-Control', 'no-cache')
      .send(buildCalendar(events));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
