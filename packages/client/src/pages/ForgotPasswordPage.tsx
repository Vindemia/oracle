import { type SyntheticEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import styles from './AuthPage.module.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post<undefined>('/auth/forgot-password', { email });
    } catch {
      // On ne distingue jamais un email connu d'un email inconnu : la
      // confirmation reste identique même en cas d'échec réseau.
    } finally {
      setIsLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h1 className={styles.title}>Mot de passe oublié</h1>
        <p className={styles.subtitle}>Entrez votre email pour recevoir un lien de réinitialisation</p>

        {submitted ? (
          <p className={styles.confirmation}>
            Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé.
          </p>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); }}
                className={styles.input}
                placeholder="votre@email.com"
                required
                autoComplete="email"
              />
            </div>

            <button type="submit" className={styles.button} disabled={isLoading}>
              {isLoading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        <p className={styles.switchLink}>
          <Link to="/login" className={styles.link}>Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
