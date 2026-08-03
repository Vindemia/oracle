import { describe, it, expect, beforeEach } from 'vitest';
import { REVELATIONS, pickRevelation, rollRevelation, type RevelationStorage } from './revelations.js';

function memoryStorage(): RevelationStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, value); },
  };
}

let storage: RevelationStorage;

beforeEach(() => {
  storage = memoryStorage();
});

describe('REVELATIONS', () => {
  it('contient un pool d\'au moins 30 citations', () => {
    expect(REVELATIONS.length).toBeGreaterThanOrEqual(30);
  });
});

describe('pickRevelation', () => {
  it('retourne toujours une citation du pool', () => {
    for (const rng of [() => 0, () => 0.999999, () => 0.5]) {
      expect(REVELATIONS).toContain(pickRevelation(rng));
    }
  });
});

describe('rollRevelation — garde-fou d\'une heure (v3-05)', () => {
  it('tire une révélation quand le RNG tombe sous le ratio (~20%)', () => {
    const result = rollRevelation(1_000_000, () => 0.1, storage);
    expect(result).not.toBeNull();
    expect(REVELATIONS).toContain(result);
  });

  it('ne tire rien quand le RNG dépasse le ratio', () => {
    const result = rollRevelation(1_000_000, () => 0.9, storage);
    expect(result).toBeNull();
  });

  it('ne tire jamais deux révélations dans la même heure, même si le RNG serait gagnant', () => {
    const first = rollRevelation(1_000_000, () => 0.1, storage);
    expect(first).not.toBeNull();

    const thirtyMinutesLater = 1_000_000 + 30 * 60 * 1000;
    const second = rollRevelation(thirtyMinutesLater, () => 0.1, storage);
    expect(second).toBeNull();
  });

  it('autorise à nouveau le tirage une heure après la précédente révélation', () => {
    const first = rollRevelation(1_000_000, () => 0.1, storage);
    expect(first).not.toBeNull();

    const oneHourAndOneMsLater = 1_000_000 + 60 * 60 * 1000 + 1;
    const second = rollRevelation(oneHourAndOneMsLater, () => 0.1, storage);
    expect(second).not.toBeNull();
  });
});
