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

const HOUR_MS = 60 * 60 * 1000;

/**
 * Instant UTC correspondant à minuit local (00:00) du jour `dateKey` dans le
 * fuseau donné. Le décalage est/ouest tient sur ±24h : on regarde l'heure
 * locale à minuit UTC du même jour calendaire et on corrige d'autant.
 * Négligé : une bascule DST survenant pile à minuit local (cas rarissime).
 */
export function localMidnightUtc(dateKey: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const naiveUtc = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const { dateKey: naiveKey, hour } = localParts(naiveUtc, timeZone);
  return naiveKey === dateKey
    ? new Date(naiveUtc.getTime() - hour * HOUR_MS)
    : new Date(naiveUtc.getTime() + (24 - hour) * HOUR_MS);
}

/** Bornes [début, fin) du mois local `YYYY-MM` — jamais UTC (v3-05, Constellation). */
export function localMonthRange(monthKey: string, timeZone: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split('-').map(Number);
  const year = y ?? 1970;
  const month = m ?? 1;
  const start = localMidnightUtc(`${monthKey}-01`, timeZone);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = localMidnightUtc(`${nextYear.toString()}-${nextMonth.toString().padStart(2, '0')}-01`, timeZone);
  return { start, end };
}
