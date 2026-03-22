import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      {icon !== undefined && <div className={styles.icon}>{icon}</div>}
      <h2 className={styles.title}>{title}</h2>
      {subtitle !== undefined && <p className={styles.subtitle}>{subtitle}</p>}
      {action !== undefined && <div className={styles.action}>{action}</div>}
    </div>
  );
}
