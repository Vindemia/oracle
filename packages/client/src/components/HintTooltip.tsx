import type { ReactNode } from 'react';
import styles from './HintTooltip.module.css';

interface HintTooltipProps {
  questions: string[];
  children: ReactNode;
}

export function HintTooltip({ questions, children }: HintTooltipProps) {
  return (
    <div className={styles.wrapper}>
      {children}
      <div className={styles.tooltip} role="tooltip">
        {questions.map((q) => (
          <p key={q} className={styles.question}>{q}</p>
        ))}
      </div>
    </div>
  );
}
