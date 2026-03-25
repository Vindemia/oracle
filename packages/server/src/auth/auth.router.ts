import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import * as authService from './auth.service.js';
import { AppError } from './auth.service.js';

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

export default router;
