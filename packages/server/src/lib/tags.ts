import type { PrismaClient } from '@prisma/client';

export const DEFAULT_TAGS = [
  { name: 'Perso', icon: '🌙', color: '#7c3aed' },
  { name: 'Boulot', icon: '☀️', color: '#d97706' },
  { name: 'Admin', icon: '📜', color: '#0369a1' },
  { name: 'Maison', icon: '🏠', color: '#15803d' },
  { name: 'Santé', icon: '🌿', color: '#059669' },
];

export async function seedUserTags(prisma: PrismaClient, userId: string) {
  await prisma.tag.createMany({
    data: DEFAULT_TAGS.map((tag) => ({
      ...tag,
      isDefault: true,
      userId,
    })),
    skipDuplicates: true,
  });
}
