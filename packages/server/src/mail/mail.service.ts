import nodemailer from 'nodemailer';

const SMTP_URL = process.env['SMTP_URL'] ?? '';
const MAIL_FROM = process.env['MAIL_FROM'] ?? '';

export const isMailConfigured = SMTP_URL !== '' && MAIL_FROM !== '';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

if (isMailConfigured) {
  transporter = nodemailer.createTransport(SMTP_URL);
} else {
  console.warn(
    '[mail] Variables SMTP_URL / MAIL_FROM absentes — envoi d\'email désactivé (lien loggé en console en dev)',
  );
}

const RESET_EXPIRATION_LABEL = '1 heure';

/**
 * Envoie l'email de réinitialisation de mot de passe. Si le SMTP n'est pas
 * configuré, ne jette jamais d'erreur : en développement, le lien est loggé
 * en console pour rester testable sans serveur mail ; en production, l'envoi
 * est silencieusement ignoré (le warning au boot signale déjà le problème).
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  if (!isMailConfigured || !transporter) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.log(`[mail] (dev) Lien de réinitialisation de mot de passe pour ${email} : ${resetUrl}`);
    }
    return;
  }

  const text = [
    'Vous avez demandé la réinitialisation de votre mot de passe.',
    '',
    `Cliquez sur ce lien pour choisir un nouveau mot de passe (valable ${RESET_EXPIRATION_LABEL}) :`,
    resetUrl,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
  ].join('\n');

  await transporter.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: 'Réinitialisation de votre mot de passe',
    text,
  });
}
