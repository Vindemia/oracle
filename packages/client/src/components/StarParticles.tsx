import { useEffect, useRef } from 'react';
import styles from './StarParticles.module.css';

interface StarParticlesProps {
  active: boolean;
  onDone?: () => void;
}

export function StarParticles({ active, onDone }: StarParticlesProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;

    const particles = Array.from({ length: 12 }, (_, i) => {
      const el = document.createElement('span');
      el.className = styles.particle ?? '';
      const angle = (i / 12) * 360;
      const dist = 30 + Math.random() * 40;
      el.style.setProperty('--angle', angle.toString() + 'deg');
      el.style.setProperty('--dist', dist.toString() + 'px');
      el.style.setProperty('--delay', (Math.random() * 0.15).toString() + 's');
      container.appendChild(el);
      return el;
    });

    const timer = setTimeout(() => {
      particles.forEach((p) => { p.remove(); });
      onDone?.();
    }, 800);

    return () => {
      clearTimeout(timer);
      particles.forEach((p) => { p.remove(); });
    };
  }, [active, onDone]);

  if (!active) return null;

  return <div ref={ref} className={styles.container} aria-hidden="true" />;
}
