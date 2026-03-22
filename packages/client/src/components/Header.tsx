import { useNavigate } from 'react-router-dom';
import styles from './Header.module.css';

export function Header() {
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>✦ Oracle</h1>
      <button
        className={styles.historyBtn}
        onClick={() => { void navigate('/history'); }}
        aria-label="Prophéties Accomplies"
        title="Prophéties Accomplies"
      >
        📜
      </button>
    </header>
  );
}
