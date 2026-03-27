import type { PrismaClient } from '@prisma/client';

export const DEFAULT_TAGS = [
  { name: 'Perso', icon: '🌙', color: '#7c3aed' },
  { name: 'Boulot', icon: '☀️', color: '#d97706' },
  { name: 'Admin', icon: '📜', color: '#0369a1' },
  { name: 'Maison', icon: '🏠', color: '#15803d' },
  { name: 'Santé', icon: '🌿', color: '#059669' },
];

export async function seedUserTags(prisma: PrismaClient, userId: string) {
  for (const tag of DEFAULT_TAGS) {
    await prisma.tag.upsert({
      where: { userId_name: { userId, name: tag.name } },
      // Si le tag existe mais a été soft-deleté, on le restaure sans écraser les persos
      update: { deletedAt: null },
      create: { ...tag, isDefault: true, userId },
    });
  }
}
