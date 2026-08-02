/**
 * Dates locales — tout ce qui dépend du fuseau de l'utilisateur.
 *
 * Extrait du scheduler (v3-03) : le Rituel de l'Aube et les Étoiles du jour
 * ont besoin de la même notion de « aujourd'hui » que les présages quotidiens.
 * Une dateKey (`YYYY-MM-DD`) est toujours la date *locale* de l'utilisateur —
 * jamais une date UTC.
 */

export interface LocalParts {
  dateKey: string;
  hour: number;
}

/** Exécute `fn` dans le fuseau demandé, avec repli sur Europe/Paris si invalide. */
export function withTimezoneFallback<T>(timeZone: string, fn: (tz: string) => T): T {
  try {
    return fn(timeZone);
  } catch {
    return fn('Europe/Paris');
  }
}

/** Date (YYYY-MM-DD) et heure locales dans le fuseau de l'utilisateur. */
export function localParts(date: Date, timeZone: string): LocalParts {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  } as const;
  return withTimezoneFallback(timeZone, (tz) => {
    const fmt = new Intl.DateTimeFormat('fr-CA', { timeZone: tz, ...options });
    const parts = fmt.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '00';
    return {
      dateKey: `${get('year')}-${get('month')}-${get('day')}`,
      hour: Number(get('hour')),
    };
  });
}

export function localTime(date: Date, timeZone: string): string {
  return withTimezoneFallback(timeZone, (tz) =>
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
      date,
    ),
  );
}

/** dateKey du jour dans le fuseau donné. */
export function todayKey(timeZone: string, now = new Date()): string {
  return localParts(now, timeZone).dateKey;
}
