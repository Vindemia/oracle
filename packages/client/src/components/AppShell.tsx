import { type ReactNode } from 'react';
import { Header } from './Header.js';
import { TaskInput } from './TaskInput.js';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  onTaskCreated?: () => void;
}

export function AppShell({ children, onTaskCreated }: AppShellProps) {
  const handleTaskCreated = () => { onTaskCreated?.(); };

  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>
        {children}
        {/* Desktop : TaskInput inline sous la matrice */}
        <div className={styles.desktopBar}>
          <TaskInput onTaskCreated={handleTaskCreated} isDesktop />
        </div>
      </main>
      {/* Mobile : TaskInput fixe en bas */}
      <div className={styles.mobileBar}>
        <TaskInput onTaskCreated={handleTaskCreated} />
      </div>
    </div>
  );
}
