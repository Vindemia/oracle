import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { getVapidPublicKey, isPushConfigured } from './push.service.js';

const router = Router();

router.use(authMiddleware);

const subscribeSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.url(),
});

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const prefsSchema = z.object({
  remindersEnabled: z.boolean().optional(),
  reminderLeadMinutes: z.number().int().min(1).max(1440).optional(),
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

  const { endpoint, keys } = parsed.data;

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: req.userId },
    });
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

  const {
    remindersEnabled,
    reminderLeadMinutes,
    dailySummaryEnabled,
    dailySummaryHour,
    staleRemindersEnabled,
    staleDays,
    timezone,
  } = parsed.data;

  try {
    const prefs = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(remindersEnabled !== undefined ? { remindersEnabled } : {}),
        ...(reminderLeadMinutes !== undefined ? { reminderLeadMinutes } : {}),
        ...(dailySummaryEnabled !== undefined ? { dailySummaryEnabled } : {}),
        ...(dailySummaryHour !== undefined ? { dailySummaryHour } : {}),
        ...(staleRemindersEnabled !== undefined ? { staleRemindersEnabled } : {}),
        ...(staleDays !== undefined ? { staleDays } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
      },
      select: prefsSelect,
    });
    res.json(prefs);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
