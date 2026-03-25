import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './Header.module.css';

export function Header() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>✦ Oracle</h1>
      <div className={styles.actions}>
        <button
          className={styles.iconBtn}
          onClick={() => { void navigate('/history'); }}
          aria-label="Prophéties Accomplies"
          title="Prophéties Accomplies"
        >
          📜
        </button>
        <button
          className={styles.iconBtn}
          onClick={() => { void navigate('/settings'); }}
          aria-label="Réglages"
          title="Réglages"
        >
          ⚙
        </button>
        <button
          className={styles.iconBtn}
          onClick={() => { void logout(); }}
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          ⏻
        </button>
      </div>
    </header>
  );
}
