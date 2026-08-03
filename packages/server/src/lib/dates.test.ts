import { describe, it, expect } from 'vitest';
import { localMonthRange } from './dates.js';

describe('localMonthRange', () => {
  it('calcule les bornes du mois local (CEST, Paris)', () => {
    const { start, end } = localMonthRange('2026-07', 'Europe/Paris');
    expect(start.toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-31T22:00:00.000Z');
  });

  it('calcule les bornes du mois local (CET, Paris)', () => {
    const { start, end } = localMonthRange('2026-01', 'Europe/Paris');
    expect(start.toISOString()).toBe('2025-12-31T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-31T23:00:00.000Z');
  });

  it('gère la bascule DST à l\'intérieur du mois (mars, Paris)', () => {
    // Le passage à l'heure d'été a lieu fin mars : début de mois en CET (+1),
    // début du mois suivant déjà en CEST (+2).
    const { start, end } = localMonthRange('2026-03', 'Europe/Paris');
    expect(start.toISOString()).toBe('2026-02-28T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-31T22:00:00.000Z');
  });

  it('repli sur Europe/Paris si le fuseau est invalide', () => {
    const withInvalid = localMonthRange('2026-07', 'Not/AZone');
    const withFallback = localMonthRange('2026-07', 'Europe/Paris');
    expect(withInvalid).toEqual(withFallback);
  });
});
