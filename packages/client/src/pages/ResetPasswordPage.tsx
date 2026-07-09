import { type SyntheticEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.js';
import styles from './AuthPage.module.css';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Ce lien de réinitialisation est invalide.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);
    try {
      await api.post<undefined>('/auth/reset-password', { token, newPassword });
      showToast('Mot de passe réinitialisé. Vous pouvez vous connecter.', 'info');
      void navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h1 className={styles.title}>Réinitialiser le mot de passe</h1>
        <p className={styles.subtitle}>Choisissez un nouveau mot de passe</p>

        <form onSubmit={(e) => { void handleSubmit(e); }} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="newPassword" className={styles.label}>Nouveau mot de passe</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); }}
              className={styles.input}
              placeholder="Minimum 8 caractères"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword" className={styles.label}>Confirmer le mot de passe</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); }}
              className={styles.input}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
          </button>
        </form>

        <p className={styles.switchLink}>
          <Link to="/login" className={styles.link}>Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
