import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import styles from './CalendarFeedSettings.module.css';

function buildFeedUrl(token: string): string {
  const base: string = import.meta.env.VITE_API_URL || '/api';
  const absolute = base.startsWith('http') ? base : window.location.origin + base;
  const url = absolute + '/calendar/' + token + '.ics';
  // webcal:// déclenche l'abonnement (rafraîchi automatiquement) dans les clients agenda.
  return url.replace(/^https?/, 'webcal');
}

export function CalendarFeedSettings() {
  const [token, setToken] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ token: string | null }>('/calendar/feed-token')
      .then((data) => {
        if (!cancelled) setToken(data.token);
      })
      .catch(() => {
        // pas bloquant — l'utilisateur pourra générer un lien
      });
    return () => {
      cancelled = true;
      if (copyTimeout.current !== null) clearTimeout(copyTimeout.current);
    };
  }, []);

  const handleGenerate = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const data = await api.post<{ token: string }>('/calendar/feed-token');
      setToken(data.token);
    } catch {
      setError('Impossible de générer le lien.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopy = async () => {
    if (token === null) return;
    try {
      await navigator.clipboard.writeText(buildFeedUrl(token));
      setCopied(true);
      if (copyTimeout.current !== null) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError('Copie impossible — sélectionnez le lien manuellement.');
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>S'abonner à l'agenda</h2>
      <p className={styles.muted}>
        Abonnez votre agenda (Google, Apple, Outlook) au flux de vos visions planifiées — il se
        mettra à jour automatiquement.
      </p>

      {token === null ? (
        <div>
          <button
            type="button"
            className={styles.btn}
            disabled={isBusy}
            onClick={() => void handleGenerate()}
          >
            {isBusy ? '…' : "📅 Générer le lien d'abonnement"}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.urlRow}>
            <input className={styles.urlInput} readOnly value={buildFeedUrl(token)} />
            <button type="button" className={styles.btn} onClick={() => void handleCopy()}>
              {copied ? '✓ Copié' : 'Copier'}
            </button>
          </div>
          <div>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={isBusy}
              onClick={() => void handleGenerate()}
            >
              {isBusy ? '…' : "↺ Régénérer (révoque l'ancien lien)"}
            </button>
          </div>
        </>
      )}

      {error !== null && <p className={styles.error}>{error}</p>}
    </section>
  );
}
