import { useEffect, useRef, useState } from 'react';
import styles from './IconPicker.module.css';

const ICON_CATALOG = [
  // Mystique & céleste
  '✦', '★', '✧', '✨', '💫', '⭐', '🌟', '🌙', '☀️', '🌕',
  '🌑', '🔮', '🌀', '⚡', '🌊', '🔥', '❄️', '💎', '🪄', '🌈',
  // Nature
  '🌿', '🌸', '🍀', '🌺', '🌻', '🍃', '🌲', '🌾', '🦋', '🌙',
  // Travail & productivité
  '📋', '📝', '📌', '🎯', '💡', '🔑', '📊', '🗓️', '⚙️', '🛠️',
  '📁', '🚀', '💼', '🏆', '📚', '🔍', '📎', '✂️', '🖊️', '📐',
  // Personnel & vie
  '🏠', '🍎', '🏃', '💪', '❤️', '🎵', '🎨', '🎭', '📷', '🌍',
  '🙏', '🤝', '👁️', '🧘', '🎮', '🍽️', '🚗', '✈️', '🏋️', '📱',
];

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [open]);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => { setOpen((o) => !o); }}
        title="Choisir une icône"
      >
        {value}
      </button>
      {open && (
        <div className={styles.popover}>
          <div className={styles.grid}>
            {ICON_CATALOG.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`${styles.iconBtn} ${icon === value ? styles.selected : ''}`}
                onClick={() => { onChange(icon); setOpen(false); }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
