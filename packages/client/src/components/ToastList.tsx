import { useToast } from '../context/ToastContext.js';
import styles from './ToastList.module.css';

export function ToastList() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[styles.toast, styles['variant_' + toast.variant]].join(' ')}
          role="button"
          tabIndex={0}
          onClick={() => { dismissToast(toast.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') dismissToast(toast.id); }}
          aria-label="Fermer la notification"
        >
          <span className={styles.message}>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={(e) => {
                e.stopPropagation();
                toast.action?.onClick();
                dismissToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
