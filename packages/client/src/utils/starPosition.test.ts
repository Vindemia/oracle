import { describe, it, expect } from 'vitest';
import { starPosition } from './starPosition.js';

describe('starPosition', () => {
  it('est déterministe : même id → même position', () => {
    const a = starPosition('task-abc-123');
    const b = starPosition('task-abc-123');
    expect(a).toEqual(b);
  });

  it('donne des positions différentes pour des ids différents', () => {
    const a = starPosition('task-1');
    const b = starPosition('task-2');
    expect(a).not.toEqual(b);
  });

  it('reste dans les marges [5, 95] en x et [5, 85] en y', () => {
    for (const id of ['a', 'zzz', 'task-99', '00000000-0000-0000-0000-000000000000']) {
      const { x, y } = starPosition(id);
      expect(x).toBeGreaterThanOrEqual(5);
      expect(x).toBeLessThanOrEqual(95);
      expect(y).toBeGreaterThanOrEqual(5);
      expect(y).toBeLessThanOrEqual(85);
    }
  });
});
