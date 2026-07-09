import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import * as authService from './auth.service.js';
import { AppError } from './auth.service.js';
import { authMiddleware } from './auth.middleware.js';
import { isThemeId } from '../lib/lexicon.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

const meSchema = z.object({
  themeId: z.string().refine(isThemeId, 'Thème inconnu'),
});

const meSelect = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
  themeId: true,
} as const;

// Base publique de l'application, utilisée pour construire le lien de reset.
const APP_URL = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    const { user, accessToken, refreshToken } = await authService.register(
      prisma,
      parsed.data.email,
      parsed.data.password,
      parsed.data.displayName,
    );
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    if (err instanceof AppError && err.code === 'CONFLICT') {
      res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    const { user, accessToken, refreshToken } = await authService.login(
      prisma,
      parsed.data.email,
      parsed.data.password,
    );
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.json({ user, accessToken, refreshToken });
  } catch (err) {
    if (err instanceof AppError && err.code === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

router.post('/refresh', async (req, res) => {
  const token = (req.cookies as Record<string, string | undefined>)['refreshToken'];
  if (!token) {
    res.status(401).json({ error: 'Missing refresh token' });
    return;
  }

  try {
    const { accessToken, refreshToken, user } = await authService.refresh(prisma, token);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.json({ accessToken, refreshToken, user });
  } catch {
    res.clearCookie('refreshToken', { path: '/' });
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req, res) => {
  const token = (req.cookies as Record<string, string | undefined>)['refreshToken'];
  if (token) {
    await authService.logout(prisma, token);
  }
  res.clearCookie('refreshToken', { path: '/' });
  res.status(204).send();
});

router.post('/forgot-password', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    await authService.requestPasswordReset(prisma, parsed.data.email, APP_URL);
  } catch (err) {
    // Anti-énumération : même en cas d'échec interne (SMTP…), on ne révèle rien.
    console.error('[auth] Échec de la demande de réinitialisation', err);
  }

  res.status(204).send();
});

router.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    await authService.resetPassword(prisma, parsed.data.token, parsed.data.newPassword);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AppError && err.code === 'BAD_REQUEST') {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Profil de l'utilisateur connecté — gap connu depuis la feature auth
 * originelle (AuthContext.tsx l'appelait déjà en fallback sans que la route
 * existe côté serveur). Sert aussi à exposer `themeId` (v3-12) pour que le
 * client applique le thème avant le premier rendu utile.
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: meSelect });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Préférences de profil — en v3, seul `themeId` est modifiable ici. Pas de
 * table d'entitlements : quand des thèmes payants arriveront (v4), c'est ici
 * que la validation de l'achat prendra place.
 */
router.patch('/me', authMiddleware, async (req, res) => {
  const parsed = meSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { themeId: parsed.data.themeId },
      select: meSelect,
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
