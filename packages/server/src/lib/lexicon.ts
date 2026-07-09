/**
 * Lexique serveur minimal (v3-12) — le scheduler compose les push (présages)
 * sans jamais avoir accès au client, donc sans accès à `ThemeContext.t()`.
 * Seul le sous-titre nécessaire aux notifications est couvert ici ; les
 * messages d'erreur `AppError` restent neutres par défaut (cf. CLAUDE.md).
 *
 * Les ids valides sont ceux du registre client (packages/client/src/themes/) —
 * dupliqués ici volontairement : le serveur ne doit pas dépendre du bundle
 * client, et cette liste est un simple contrat de validation + de choix de
 * lexique, pas le modèle complet du thème (tokens visuels…).
 */
export type ThemeId = 'neutral' | 'oracle';

export const THEME_IDS: readonly ThemeId[] = ['neutral', 'oracle'];

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}

/** Repli défensif — toute valeur inconnue (données pré-migration, test…) retombe sur le thème par défaut. */
export function resolveThemeId(value: string | null | undefined): ThemeId {
  return value !== null && value !== undefined && isThemeId(value) ? value : 'neutral';
}

function plural(count: number, suffix = 's'): string {
  return count > 1 ? suffix : '';
}

export interface ReminderPushContent {
  title: string;
  body: string;
}

/** Rappel d'échéance — une vision/tâche approche. */
export function reminderPush(themeId: ThemeId, taskTitle: string, time: string): ReminderPushContent {
  if (themeId === 'oracle') {
    return {
      title: "L'Oracle murmure…",
      body: `La vision « ${taskTitle} » approche (${time}).`,
    };
  }
  return {
    title: 'Rappel',
    body: `« ${taskTitle} » approche (${time}).`,
  };
}

export interface DailySummaryInput {
  fireCount: number;
  plannedToday: number;
}

/** Résumé matinal — `null` si rien à annoncer (le scheduler n'envoie alors rien). */
export function dailySummaryPush(
  themeId: ThemeId,
  { fireCount, plannedToday }: DailySummaryInput,
): ReminderPushContent | null {
  if (fireCount === 0 && plannedToday === 0) return null;

  const pieces: string[] = [];
  if (themeId === 'oracle') {
    if (fireCount > 0) {
      pieces.push(`${fireCount.toString()} vision${plural(fireCount)} dans le Brasier`);
    }
    if (plannedToday > 0) {
      pieces.push(
        `${plannedToday.toString()} vision${plural(plannedToday)} planifiée${plural(plannedToday)} aujourd'hui`,
      );
    }
    return { title: 'Les présages du jour', body: pieces.join(' · ') + '.' };
  }

  if (fireCount > 0) {
    pieces.push(
      `${fireCount.toString()} tâche${plural(fireCount)} urgente${plural(fireCount)} et importante${plural(fireCount)}`,
    );
  }
  if (plannedToday > 0) {
    pieces.push(
      `${plannedToday.toString()} tâche${plural(plannedToday)} planifiée${plural(plannedToday)} aujourd'hui`,
    );
  }
  return { title: 'Priorités du jour', body: pieces.join(' · ') + '.' };
}

export interface StaleReminderInput {
  staleCount: number;
  staleDays: number;
}

/** Relance des tâches négligées — `null` si aucune. */
export function staleReminderPush(
  themeId: ThemeId,
  { staleCount, staleDays }: StaleReminderInput,
): ReminderPushContent | null {
  if (staleCount === 0) return null;

  if (themeId === 'oracle') {
    return {
      title: 'Des visions sommeillent…',
      body: `${staleCount.toString()} vision${plural(staleCount)} attend${staleCount > 1 ? 'ent' : ''} dans la brume depuis plus de ${staleDays.toString()} jours.`,
    };
  }
  return {
    title: 'Tâches en attente',
    body: `${staleCount.toString()} tâche${plural(staleCount)} sans activité depuis plus de ${staleDays.toString()} jours.`,
  };
}
