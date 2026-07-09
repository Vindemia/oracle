import { describe, it, expect } from 'vitest';
import {
  THEME_IDS,
  isThemeId,
  resolveThemeId,
  reminderPush,
  dailySummaryPush,
  staleReminderPush,
} from './lexicon.js';

describe('THEME_IDS / isThemeId', () => {
  it('contient neutral et oracle', () => {
    expect(THEME_IDS).toEqual(['neutral', 'oracle']);
  });

  it('valide un id connu', () => {
    expect(isThemeId('neutral')).toBe(true);
    expect(isThemeId('oracle')).toBe(true);
  });

  it('rejette un id inconnu', () => {
    expect(isThemeId('galactic')).toBe(false);
    expect(isThemeId('')).toBe(false);
  });
});

describe('resolveThemeId', () => {
  it('retombe sur neutral si null/undefined/inconnu', () => {
    expect(resolveThemeId(null)).toBe('neutral');
    expect(resolveThemeId(undefined)).toBe('neutral');
    expect(resolveThemeId('galactic')).toBe('neutral');
  });

  it('conserve un id valide', () => {
    expect(resolveThemeId('oracle')).toBe('oracle');
    expect(resolveThemeId('neutral')).toBe('neutral');
  });
});

describe('reminderPush', () => {
  it('compose le rappel avec le lexique oracle', () => {
    const { title, body } = reminderPush('oracle', 'Appeler le dentiste', '14:30');
    expect(title).toBe("L'Oracle murmure…");
    expect(body).toBe('La vision « Appeler le dentiste » approche (14:30).');
  });

  it('compose le rappel avec le lexique neutre', () => {
    const { title, body } = reminderPush('neutral', 'Appeler le dentiste', '14:30');
    expect(title).toBe('Rappel');
    expect(body).toBe('« Appeler le dentiste » approche (14:30).');
  });
});

describe('dailySummaryPush', () => {
  it('retourne null si rien à annoncer', () => {
    expect(dailySummaryPush('oracle', { fireCount: 0, plannedToday: 0 })).toBeNull();
    expect(dailySummaryPush('neutral', { fireCount: 0, plannedToday: 0 })).toBeNull();
  });

  it('compose le résumé oracle avec pluriels', () => {
    const content = dailySummaryPush('oracle', { fireCount: 2, plannedToday: 1 });
    expect(content).toEqual({
      title: 'Les présages du jour',
      body: '2 visions dans le Brasier · 1 vision planifiée aujourd\'hui.',
    });
  });

  it('compose le résumé neutre avec pluriels', () => {
    const content = dailySummaryPush('neutral', { fireCount: 2, plannedToday: 1 });
    expect(content).toEqual({
      title: 'Priorités du jour',
      body: '2 tâches urgentes et importantes · 1 tâche planifiée aujourd\'hui.',
    });
  });
});

describe('staleReminderPush', () => {
  it('retourne null si aucune tâche négligée', () => {
    expect(staleReminderPush('oracle', { staleCount: 0, staleDays: 7 })).toBeNull();
  });

  it('compose la relance oracle', () => {
    const content = staleReminderPush('oracle', { staleCount: 3, staleDays: 7 });
    expect(content).toEqual({
      title: 'Des visions sommeillent…',
      body: '3 visions attendent dans la brume depuis plus de 7 jours.',
    });
  });

  it('compose la relance neutre', () => {
    const content = staleReminderPush('neutral', { staleCount: 1, staleDays: 7 });
    expect(content).toEqual({
      title: 'Tâches en attente',
      body: '1 tâche sans activité depuis plus de 7 jours.',
    });
  });
});
