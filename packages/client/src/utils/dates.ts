/** dateKey locale du jour (`YYYY-MM-DD`) — même convention que le serveur (v3-03). */
export function todayKey(now = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear().toString()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Une Étoile du jour n'est jamais nettoyée côté serveur : on compare à aujourd'hui. */
export function isStarredToday(task: { starredOn: string | null }, now = new Date()): boolean {
  return task.starredOn === todayKey(now);
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays.toString()}j`;
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7).toString()}sem`;
  return `il y a ${Math.floor(diffDays / 30).toString()}mois`;
}
