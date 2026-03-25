import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import { seedUserTags } from '../lib/tags.js';

const ACCESS_SECRET = process.env['JWT_ACCESS_SECRET'] ?? 'access-secret-dev';
const REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] ?? 'refresh-secret-dev';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: 'CONFLICT' | 'UNAUTHORIZED',
  ) {
    super(message);
    this.name = 'AppError';
  }
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
