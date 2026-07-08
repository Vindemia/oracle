import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { seedUserTags } from '../lib/tags.js';
import { sendPasswordResetEmail } from '../mail/mail.service.js';

const ACCESS_SECRET = process.env['JWT_ACCESS_SECRET'] ?? 'access-secret-dev';
const REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] ?? 'refresh-secret-dev';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

// Récupération de mot de passe
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRES_MS = 60 * 60 * 1000; // 1h
const RESET_RATE_LIMIT = 3;
const RESET_RATE_WINDOW_MS = 60 * 60 * 1000; // 1h
const RESET_GENERIC_ERROR = 'Ce lien a expiré ou a déjà servi.';

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: 'CONFLICT' | 'UNAUTHORIZED' | 'BAD_REQUEST',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token: string): { sub: string } {
  return jwt.verify(token, ACCESS_SECRET) as { sub: string };
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}

export async function register(
  prisma: PrismaClient,
  email: string,
  password: string,
  displayName: string,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('Email already in use', 'CONFLICT');
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hashed, displayName },
    select: { id: true, email: true, displayName: true, createdAt: true },
  });

  await seedUserTags(prisma, user.id);

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
    },
  });

  return { user, accessToken, refreshToken };
}

export async function login(prisma: PrismaClient, email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Invalid credentials', 'UNAUTHORIZED');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new AppError('Invalid credentials', 'UNAUTHORIZED');
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
    },
  });

  const safeUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  return { user: safeUser, accessToken, refreshToken };
}

export async function refresh(prisma: PrismaClient, token: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError('Invalid refresh token', 'UNAUTHORIZED');
  }

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Invalid refresh token', 'UNAUTHORIZED');
  }

  // Rotation : invalider l'ancien token
  await prisma.refreshToken.delete({ where: { token } });

  const accessToken = generateAccessToken(payload.sub);
  const newRefreshToken = generateRefreshToken(payload.sub);
  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: payload.sub,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, displayName: true, createdAt: true },
  });

  return { accessToken, refreshToken: newRefreshToken, user };
}

export async function logout(prisma: PrismaClient, token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

/**
 * Anti-énumération : ne révèle jamais si l'email existe. Le routeur répond
 * toujours 204, que cette fonction ait effectivement envoyé un email ou non.
 * Rate limit silencieux : au-delà de RESET_RATE_LIMIT demandes / heure pour
 * un même utilisateur, la demande est ignorée sans erreur.
 */
export async function requestPasswordReset(
  prisma: PrismaClient,
  email: string,
  appUrl: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const windowStart = new Date(Date.now() - RESET_RATE_WINDOW_MS);
  const recentCount = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: windowStart } },
  });
  if (recentCount >= RESET_RATE_LIMIT) return;

  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);

  await prisma.passwordResetToken.create({
    data: { tokenHash, expiresAt, userId: user.id },
  });

  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

/**
 * Vérifie le token (hash + non-expiré + non-utilisé), met à jour le mot de
 * passe et révoque tous les refresh tokens de l'utilisateur (déconnexion
 * globale). Erreur générique dans tous les cas d'échec pour ne pas
 * distinguer "token inconnu" de "token expiré/déjà utilisé".
 */
export async function resetPassword(
  prisma: PrismaClient,
  token: string,
  newPassword: string,
): Promise<void> {
  const tokenHash = hashResetToken(token);
  const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.usedAt !== null || stored.expiresAt < new Date()) {
    throw new AppError(RESET_GENERIC_ERROR, 'BAD_REQUEST');
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.passwordResetToken.update({
    where: { id: stored.id },
    data: { usedAt: new Date() },
  });
  await prisma.user.update({ where: { id: stored.userId }, data: { password: hashed } });
  await prisma.refreshToken.deleteMany({ where: { userId: stored.userId } });
}

/** Purge des tokens de réinitialisation expirés — appelée par le scheduler. */
export async function purgeExpiredPasswordResetTokens(
  prisma: PrismaClient,
  now = new Date(),
): Promise<void> {
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
}
