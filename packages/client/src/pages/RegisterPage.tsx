import { type SyntheticEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import styles from './AuthPage.module.css';

export function RegisterPage() {
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);
    try {
      await register(displayName, email, password);
      void navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h1 className={styles.title}>Oracle</h1>
        <p className={styles.subtitle}>Votre initiation commence ici</p>

        <form onSubmit={(e) => { void handleSubmit(e); }} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="displayName" className={styles.label}>Nom</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); }}
              className={styles.input}
              placeholder="Votre nom"
              required
              autoComplete="name"
            />
          </div>

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

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
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
            {isLoading ? 'Initiation…' : '✦ Rejoindre l\'Oracle'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Déjà initié ?{' '}
          <Link to="/login" className={styles.link}>Consulter l'Oracle</Link>
        </p>
      </div>
    </div>
  );
}
