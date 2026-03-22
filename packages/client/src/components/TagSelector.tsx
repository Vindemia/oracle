import type { Tag } from '../types/index.js';
import styles from './TagSelector.module.css';

interface TagSelectorProps {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r.toString()}, ${g.toString()}, ${b.toString()}, ${alpha.toString()})`;
}

export function TagSelector({ tags, selectedIds, onChange }: TagSelectorProps) {
  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((t) => t !== id)
        : [...selectedIds, id],
    );
  };

  if (tags.length === 0) return null;

  return (
    <div className={styles.row}>
      {tags.map((tag) => {
        const active = selectedIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            className={[styles.chip, active ? styles.active : undefined].filter(Boolean).join(' ')}
            style={active ? {
              backgroundColor: hexToRgba(tag.color, 0.18),
              borderColor: hexToRgba(tag.color, 0.6),
              color: tag.color,
            } : undefined}
            onClick={() => { toggle(tag.id); }}
          >
            {tag.icon} {tag.name}
          </button>
        );
      })}
    </div>
  );
}
