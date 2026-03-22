import type { Tag } from '../types/index.js';
import styles from './TagBadge.module.css';

interface TagBadgeProps {
  tag: Tag;
  size?: 'sm' | 'md';
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r.toString()}, ${g.toString()}, ${b.toString()}, ${alpha.toString()})`;
}

export function TagBadge({ tag, size = 'sm' }: TagBadgeProps) {
  const bg = hexToRgba(tag.color, 0.18);
  const border = hexToRgba(tag.color, 0.4);

  return (
    <span
      className={[styles.badge, size === 'md' ? styles.md : styles.sm].join(' ')}
      style={{ backgroundColor: bg, borderColor: border, color: tag.color }}
    >
      {tag.icon} {tag.name}
    </span>
  );
}
