import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('mail.service — sans SMTP configuré', () => {
  const originalSmtpUrl = process.env['SMTP_URL'];
  const originalMailFrom = process.env['MAIL_FROM'];
  const originalNodeEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    delete process.env['SMTP_URL'];
    delete process.env['MAIL_FROM'];
    vi.resetModules();
  });

  afterEach(() => {
    if (originalSmtpUrl !== undefined) {
      process.env['SMTP_URL'] = originalSmtpUrl;
    } else {
      delete process.env['SMTP_URL'];
    }
    if (originalMailFrom !== undefined) {
      process.env['MAIL_FROM'] = originalMailFrom;
    } else {
      delete process.env['MAIL_FROM'];
    }
    if (originalNodeEnv !== undefined) {
      process.env['NODE_ENV'] = originalNodeEnv;
    } else {
      delete process.env['NODE_ENV'];
    }
    vi.resetModules();
  });

  it('avertit au chargement du module (variables absentes)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await import('./mail.service.js');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SMTP_URL'));
    warnSpy.mockRestore();
  });

  it('en dev : loggue le lien de reset en console et ne lève jamais d\'erreur', async () => {
    process.env['NODE_ENV'] = 'development';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { sendPasswordResetEmail, isMailConfigured } = await import('./mail.service.js');
    const resetUrl = 'https://app.example.com/reset-password?token=abc123';

    expect(isMailConfigured).toBe(false);
    await expect(sendPasswordResetEmail('test@example.com', resetUrl)).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(resetUrl));

    logSpy.mockRestore();
  });

  it('hors dev (production) : ne loggue rien et ne lève pas d\'erreur (pas de 500)', async () => {
    process.env['NODE_ENV'] = 'production';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { sendPasswordResetEmail } = await import('./mail.service.js');
    const resetUrl = 'https://app.example.com/reset-password?token=abc123';

    await expect(sendPasswordResetEmail('test@example.com', resetUrl)).resolves.toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
