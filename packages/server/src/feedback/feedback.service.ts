import type { Feedback, FeedbackKind, Prisma, PrismaClient } from '@prisma/client';

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: 'RATE_LIMITED',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Nombre maximal d'échos qu'une utilisatrice peut envoyer par jour. */
export const DAILY_FEEDBACK_LIMIT = 10;

export interface CreateFeedbackInput {
  kind: FeedbackKind;
  message: string;
  context?: Record<string, unknown> | undefined;
}

/**
 * Persiste un écho. Ne contacte jamais GitHub — la synchronisation est prise
 * en charge de façon asynchrone par le scheduler (`feedback.sync.ts`), afin
 * que l'utilisatrice n'attende jamais un appel réseau externe.
 */
export async function createFeedback(
  prisma: PrismaClient,
  userId: string,
  input: CreateFeedbackInput,
): Promise<Feedback> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const countToday = await prisma.feedback.count({
    where: { userId, createdAt: { gte: startOfDay } },
  });
  if (countToday >= DAILY_FEEDBACK_LIMIT) {
    throw new AppError("Tu as atteint la limite quotidienne d'échos. Reviens demain !", 'RATE_LIMITED');
  }

  return prisma.feedback.create({
    data: {
      kind: input.kind,
      message: input.message,
      userId,
      ...(input.context !== undefined ? { context: input.context as Prisma.InputJsonValue } : {}),
    },
  });
}
