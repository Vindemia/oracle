import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Le module lit process.env au chargement — isoler via resetModules + import dynamique.
describe('ACCESS_SECRET', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('crashe au boot si JWT_SECRET est absent en production', async () => {
    delete process.env['JWT_SECRET'];
    process.env['NODE_ENV'] = 'production';

    await expect(import('./auth.service.js')).rejects.toThrow('JWT_SECRET manquant');
  });

  it("n'exige pas JWT_SECRET hors production (fallback dev)", async () => {
    delete process.env['JWT_SECRET'];
    process.env['NODE_ENV'] = 'test';

    await expect(import('./auth.service.js')).resolves.toBeDefined();
  });
});
