import webpush from 'web-push';
import prisma from '../lib/prisma.js';

const VAPID_PUBLIC_KEY = process.env['VAPID_PUBLIC_KEY'] ?? '';
const VAPID_PRIVATE_KEY = process.env['VAPID_PRIVATE_KEY'] ?? '';
const VAPID_SUBJECT = process.env['VAPID_SUBJECT'] ?? '';

export const isPushConfigured =
  VAPID_PUBLIC_KEY !== '' && VAPID_PRIVATE_KEY !== '' && VAPID_SUBJECT !== '';

if (isPushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('[push] Variables VAPID_* absentes — notifications push désactivées');
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envoie un présage à toutes les subscriptions de l'utilisateur.
 * Les subscriptions expirées (404/410) sont purgées au passage.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isPushConfigured) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => undefined);
        } else {
          console.error('[push] Échec d\'envoi', err);
        }
      }
    }),
  );
}
