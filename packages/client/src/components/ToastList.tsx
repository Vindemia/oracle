import { useToast } from '../context/ToastContext.js';
import styles from './ToastList.module.css';

export function ToastList() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={[styles.toast, styles['variant_' + toast.variant]].join(' ')}
          onClick={() => { dismissToast(toast.id); }}
          aria-label="Fermer la notification"
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
