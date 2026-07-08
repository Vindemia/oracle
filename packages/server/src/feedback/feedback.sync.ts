import type { FeedbackKind } from '@prisma/client';
import prisma from '../lib/prisma.js';

const GITHUB_TOKEN = process.env['GITHUB_FEEDBACK_TOKEN'] ?? '';
const GITHUB_REPO = process.env['GITHUB_FEEDBACK_REPO'] ?? '';

export const isGithubFeedbackConfigured = GITHUB_TOKEN !== '' && GITHUB_REPO !== '';

if (!isGithubFeedbackConfigured) {
  console.warn(
    '[feedback] Variables GITHUB_FEEDBACK_TOKEN/GITHUB_FEEDBACK_REPO absentes — synchronisation GitHub désactivée, les échos restent en base sans perte',
  );
}

const KIND_LABELS: Record<FeedbackKind, string> = {
  PRAISE: 'praise',
  IDEA: 'idea',
  BUG: 'bug',
};

interface FeedbackForSync {
  id: string;
  kind: FeedbackKind;
  message: string;
  context: unknown;
  createdAt: Date;
  userId: string;
}

/** `displayName` de l'utilisatrice, jamais son email — pseudonyme dérivé en repli. */
function resolveAuthorLabel(userId: string, displayName: string | null | undefined): string {
  if (displayName !== null && displayName !== undefined && displayName.trim() !== '') {
    return displayName;
  }
  return `Utilisatrice #${userId.slice(0, 8)}`;
}

function buildIssueBody(feedback: FeedbackForSync, author: string): string {
  const context: Record<string, unknown> =
    typeof feedback.context === 'object' && feedback.context !== null
      ? (feedback.context as Record<string, unknown>)
      : {};

  const lines = [
    feedback.message,
    '',
    '---',
    `**Type** : ${feedback.kind}`,
    `**Auteur** : ${author}`,
    `**Date** : ${feedback.createdAt.toISOString()}`,
  ];
  if (typeof context['route'] === 'string') lines.push(`**Route** : ${context['route']}`);
  if (typeof context['version'] === 'string') lines.push(`**Version** : ${context['version']}`);
  if (typeof context['userAgent'] === 'string') {
    lines.push(`**Navigateur** : ${context['userAgent']}`);
  }
  return lines.join('\n');
}

/** Crée l'issue GitHub correspondant à l'écho. `null` si l'appel a échoué (réseau ou API). */
async function createGithubIssue(feedback: FeedbackForSync): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: feedback.userId },
    select: { displayName: true },
  });
  const author = resolveAuthorLabel(feedback.userId, user?.displayName);
  const title = `[écho] ${feedback.message.slice(0, 60)}`;
  const body = buildIssueBody(feedback, author);
  const labels = ['echo', KIND_LABELS[feedback.kind]];

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, body, labels }),
    });

    if (!response.ok) {
      console.error('[feedback] Échec de création de l\'issue GitHub', response.status);
      return null;
    }

    const json = (await response.json()) as { html_url: string };
    return json.html_url;
  } catch (err) {
    console.error('[feedback] Erreur réseau lors de la synchronisation GitHub', err);
    return null;
  }
}

/**
 * Tick de synchronisation des échos vers GitHub. Claim atomique sur
 * `syncedAt` (comme les autres ticks du scheduler) : on le marque avant
 * l'appel réseau pour éviter tout doublon si le tick tourne deux fois en
 * parallèle, puis on le relâche (repasse à `null`) en cas d'échec pour
 * retenter silencieusement au tick suivant — aucun écho n'est jamais perdu.
 */
export async function tickFeedbackSync(): Promise<void> {
  if (!isGithubFeedbackConfigured) return;

  const pending = await prisma.feedback.findMany({
    where: { syncedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  for (const feedback of pending) {
    const claimed = await prisma.feedback.updateMany({
      where: { id: feedback.id, syncedAt: null },
      data: { syncedAt: new Date() },
    });
    if (claimed.count === 0) continue;

    const url = await createGithubIssue(feedback);
    if (url !== null) {
      await prisma.feedback.update({ where: { id: feedback.id }, data: { githubIssueUrl: url } });
    } else {
      await prisma.feedback.update({ where: { id: feedback.id }, data: { syncedAt: null } });
    }
  }
}
