import { usePushNotifications } from '../hooks/usePushNotifications.js';
import styles from './PushSettings.module.css';

const LEAD_OPTIONS = [5, 15, 30, 60];
const STALE_OPTIONS = [3, 7, 14, 30];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function PushSettings() {
  const { isSupported, permission, isSubscribed, prefs, isBusy, error, subscribe, unsubscribe, updatePrefs } =
    usePushNotifications();

  if (!isSupported) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Présages</h2>
        <p className={styles.muted}>
          Votre navigateur ne prend pas en charge les notifications push.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Présages</h2>
      <p className={styles.muted}>
        Recevez les murmures de l'Oracle : rappels d'échéance, présages du matin et visions oubliées.
      </p>

      {!isSubscribed ? (
        <div>
          <button
            type="button"
            className={styles.btn}
            disabled={isBusy || permission === 'denied'}
            onClick={() => void subscribe()}
          >
            {isBusy ? '…' : '🔔 Activer les présages sur cet appareil'}
          </button>
          {permission === 'denied' && (
            <p className={styles.muted}>
              Les notifications sont bloquées pour ce site — débloquez-les dans les réglages du
              navigateur.
            </p>
          )}
        </div>
      ) : (
        <>
          {prefs && (
            <ul className={styles.prefList}>
              <li className={styles.prefItem}>
                <label className={styles.prefLabel}>
                  <input
                    type="checkbox"
                    checked={prefs.remindersEnabled}
                    onChange={(e) => void updatePrefs({ remindersEnabled: e.target.checked })}
                  />
                  <span>Rappel d'échéance</span>
                </label>
                <select
                  className={styles.select}
                  value={prefs.reminderLeadMinutes}
                  disabled={!prefs.remindersEnabled}
                  onChange={(e) => void updatePrefs({ reminderLeadMinutes: Number(e.target.value) })}
                >
                  {LEAD_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m.toString()} min avant
                    </option>
                  ))}
                </select>
              </li>

              <li className={styles.prefItem}>
                <label className={styles.prefLabel}>
                  <input
                    type="checkbox"
                    checked={prefs.dailySummaryEnabled}
                    onChange={(e) => void updatePrefs({ dailySummaryEnabled: e.target.checked })}
                  />
                  <span>Résumé matinal</span>
                </label>
                <select
                  className={styles.select}
                  value={prefs.dailySummaryHour}
                  disabled={!prefs.dailySummaryEnabled}
                  onChange={(e) => void updatePrefs({ dailySummaryHour: Number(e.target.value) })}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h.toString()} h
                    </option>
                  ))}
                </select>
              </li>

              <li className={styles.prefItem}>
                <label className={styles.prefLabel}>
                  <input
                    type="checkbox"
                    checked={prefs.staleRemindersEnabled}
                    onChange={(e) => void updatePrefs({ staleRemindersEnabled: e.target.checked })}
                  />
                  <span>Relance des visions négligées</span>
                </label>
                <select
                  className={styles.select}
                  value={prefs.staleDays}
                  disabled={!prefs.staleRemindersEnabled}
                  onChange={(e) => void updatePrefs({ staleDays: Number(e.target.value) })}
                >
                  {STALE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      après {d.toString()} jours
                    </option>
                  ))}
                </select>
              </li>
            </ul>
          )}

          <div>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={isBusy}
              onClick={() => void unsubscribe()}
            >
              {isBusy ? '…' : 'Désactiver sur cet appareil'}
            </button>
          </div>
        </>
      )}

      {error !== null && <p className={styles.error}>{error}</p>}
    </section>
  );
}
