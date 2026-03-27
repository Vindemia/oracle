import { ScrollIcon, GearIcon, SignOutIcon } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './Header.module.css';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const toggle = (path: string) => {
    void navigate(location.pathname === path ? '/' : path);
  };

  return (
    <header className={styles.header}>
      <button
        className={styles.titleBtn}
        onClick={() => { void navigate('/'); }}
        aria-label="Accueil"
      >
        ✦ Oracle
      </button>
      <div className={styles.actions}>
        <button
          className={[styles.iconBtn, location.pathname === '/history' ? styles.active : null].filter(Boolean).join(' ')}
          onClick={() => { toggle('/history'); }}
          aria-label="Prophéties Accomplies"
          title="Prophéties Accomplies"
        >
          <ScrollIcon size={20} weight={location.pathname === '/history' ? 'duotone' : 'regular'} />
        </button>
        <button
          className={[styles.iconBtn, location.pathname === '/settings' ? styles.active : null].filter(Boolean).join(' ')}
          onClick={() => { toggle('/settings'); }}
          aria-label="Réglages"
          title="Réglages"
        >
          <GearIcon size={20} weight={location.pathname === '/settings' ? 'duotone' : 'regular'} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={() => { void logout(); }}
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <SignOutIcon size={20} weight="regular" />
        </button>
      </div>
    </header>
  );
}
