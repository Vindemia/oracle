import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { getVapidPublicKey, isPushConfigured } from './push.service.js';
import type { Prisma } from '@prisma/client';

const router = Router();

router.use(authMiddleware);

/** Délai de rappel maximal autorisé (cf. prefsSchema et scheduler.tickReminders). */
export const MAX_LEAD_MINUTES = 1440;

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const subscribeSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  timezone: z.string().refine(isValidTimezone, 'Fuseau horaire invalide').optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.url(),
});

const prefsSchema = z.object({
  remindersEnabled: z.boolean().optional(),
  reminderLeadMinutes: z.number().int().min(1).max(MAX_LEAD_MINUTES).optional(),
  dailySummaryEnabled: z.boolean().optional(),
  dailySummaryHour: z.number().int().min(0).max(23).optional(),
  staleRemindersEnabled: z.boolean().optional(),
  staleDays: z.number().int().min(1).max(90).optional(),
  timezone: z.string().refine(isValidTimezone, 'Fuseau horaire invalide').optional(),
});

const prefsSelect = {
  remindersEnabled: true,
  reminderLeadMinutes: true,
  dailySummaryEnabled: true,
  dailySummaryHour: true,
  staleRemindersEnabled: true,
  staleDays: true,
  timezone: true,
} as const;

router.get('/vapid-public-key', (_req, res) => {
  if (!isPushConfigured) {
    res.status(503).json({ error: 'Notifications push non configurées sur le serveur' });
    return;
  }
  res.json({ publicKey: getVapidPublicKey() });
});

router.post('/subscribe', async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  const { endpoint, keys, timezone } = parsed.data;

  try {
    // Premier appareil ? On le détermine avant l'upsert pour ne pas décaler
    // l'heure du résumé quotidien si un 2e appareil (autre fuseau) s'abonne
    // ensuite. Inutile de faire la requête si aucune timezone n'est fournie.
    const isFirstDevice =
      timezone !== undefined &&
      (await prisma.pushSubscription.count({ where: { userId: req.userId } })) === 0;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: req.userId },
    });

    if (isFirstDevice) {
      await prisma.user.update({ where: { id: req.userId }, data: { timezone } });
    }

    res.status(201).json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/subscribe', async (req, res) => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: req.userId },
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/prefs', async (req, res) => {
  try {
    const prefs = await prisma.user.findUnique({
      where: { id: req.userId },
      select: prefsSelect,
    });
    if (!prefs) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(prefs);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/prefs', async (req, res) => {
  const parsed = prefsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    // Zod v4 n'affecte que les clés réellement fournies dans le body ; Prisma
    // ignore les clés absentes/undefined dans `data`. Le cast est nécessaire
    // car `exactOptionalPropertyTypes` distingue `key?: T` (Prisma) de
    // `key?: T | undefined` (type inféré par Zod pour un champ `.optional()`).
    const prefs = await prisma.user.update({
      where: { id: req.userId },
      data: parsed.data as Prisma.UserUpdateInput,
      select: prefsSelect,
    });
    res.json(prefs);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
