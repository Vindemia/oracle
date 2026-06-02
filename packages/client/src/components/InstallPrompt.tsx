import { useEffect, useState } from 'react';
import styles from './InstallPrompt.module.css';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'oracle-install-dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    ('standalone' in window.navigator && window.navigator.standalone === true)
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === '1') return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setDeferred(null); };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const handleInstall = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDeferred(null);
  };

  return (
    <div className={styles.banner} role="dialog" aria-label="Installer Oracle">
      <div className={styles.text}>
        <span className={styles.title}>Ancrer l'Oracle</span>
        <span className={styles.subtitle}>Installez l'app pour un accès immédiat</span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.dismiss} onClick={handleDismiss}>
          Plus tard
        </button>
        <button type="button" className={styles.install} onClick={() => void handleInstall()}>
          Installer
        </button>
      </div>
    </div>
  );
}
