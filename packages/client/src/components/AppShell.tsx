import { type ReactNode, useState } from 'react';
import { Header } from './Header.js';
import { BottomBar } from './BottomBar.js';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  onAddVision?: (title: string) => void;
}

export function AppShell({ children, onAddVision }: AppShellProps) {
  const [newVision, setNewVision] = useState('');

  const handleSubmit = () => {
    const trimmed = newVision.trim();
    if (!trimmed) return;
    onAddVision?.(trimmed);
    setNewVision('');
  };

  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>
        {children}
        {/* Desktop : barre d'ajout inline sous la matrice */}
        <div className={styles.desktopBar}>
          <BottomBar
            value={newVision}
            onChange={setNewVision}
            onSubmit={handleSubmit}
            isDesktop
          />
        </div>
      </main>
      {/* Mobile : barre d'ajout fixe en bas */}
      <div className={styles.mobileBar}>
        <BottomBar
          value={newVision}
          onChange={setNewVision}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
