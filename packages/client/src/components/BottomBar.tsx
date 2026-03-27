import type { KeyboardEvent } from 'react';
import styles from './BottomBar.module.css';

interface BottomBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isDesktop?: boolean;
}

export function BottomBar({ value, onChange, onSubmit, isDesktop = false }: BottomBarProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) onSubmit();
  };

  return (
    <div className={isDesktop ? styles.inlineBar : styles.fixedBar}>
      <input
        type="text"
        className={styles.input}
        placeholder="Nouvelle vision..."
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        onKeyDown={handleKeyDown}
        aria-label="Nouvelle vision"
      />
      <button
        className={styles.revealBtn}
        onClick={onSubmit}
        disabled={!value.trim()}
        aria-label="Révéler"
      >
        Révéler
      </button>
    </div>
  );
}
