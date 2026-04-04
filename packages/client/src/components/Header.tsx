import { ScrollIcon, GearIcon, SignOutIcon, QuestionIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { HelpDrawer } from './HelpDrawer.js';
import styles from './Header.module.css';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);

  const toggle = (path: string) => {
    void navigate(location.pathname === path ? '/' : path);
  };

  return (
    <>
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
            className={[styles.iconBtn, location.pathname === '/focus' ? styles.active : null].filter(Boolean).join(' ')}
            onClick={() => { toggle('/focus'); }}
            aria-label="Focus — Phase Planification"
            title="Focus"
          >
            <span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1 }}>✦</span>
          </button>
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
            className={[styles.iconBtn, helpOpen ? styles.active : null].filter(Boolean).join(' ')}
            onClick={() => { setHelpOpen((v) => !v); }}
            aria-label="Guide — Matrice d'Eisenhower"
            title="Guide"
          >
            <QuestionIcon size={20} weight={helpOpen ? 'duotone' : 'regular'} />
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
      <HelpDrawer open={helpOpen} onClose={() => { setHelpOpen(false); }} />
    </>
  );
}
