import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

export interface PushPrefs {
  remindersEnabled: boolean;
  reminderLeadMinutes: number;
  dailySummaryEnabled: boolean;
  dailySummaryHour: number;
  staleRemindersEnabled: boolean;
  staleDays: number;
  timezone: string;
}

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// La clé VAPID publique arrive en base64url ; PushManager attend un BufferSource
// adossé à un ArrayBuffer (pas un ArrayBufferLike).
function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function usePushNotifications() {
  const [isSupported] = useState(isPushSupported);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    isPushSupported() ? Notification.permission : 'denied',
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const loaded = await api.get<PushPrefs>('/push/prefs');
        if (!cancelled) setPrefs(loaded);
      } catch {
        // préférences non chargées — la section restera en lecture par défaut
      }

      if (!isPushSupported()) return;
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!cancelled) setIsSubscribed(subscription !== null && subscription !== undefined);
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        setError('Permission refusée — autorisez les notifications dans votre navigateur.');
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setError("Service worker absent — rechargez la page puis réessayez.");
        return;
      }

      const { publicKey } = await api.get<{ publicKey: string }>('/push/vapid-public-key');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON();
      await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });

      // Cale le résumé matinal sur le fuseau réel de l'appareil.
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const updated = await api.patch<PushPrefs>('/push/prefs', { timezone });
      setPrefs(updated);
      setIsSubscribed(true);
    } catch {
      setError("Impossible d'activer les présages.");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api.delete('/push/subscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch {
      setError('Impossible de désactiver les présages.');
    } finally {
      setIsBusy(false);
    }
  }, []);

  const updatePrefs = useCallback(async (partial: Partial<PushPrefs>) => {
    setError(null);
    try {
      const updated = await api.patch<PushPrefs>('/push/prefs', partial);
      setPrefs(updated);
    } catch {
      setError('Impossible de mettre à jour les préférences.');
    }
  }, []);

  return { isSupported, permission, isSubscribed, prefs, isBusy, error, subscribe, unsubscribe, updatePrefs };
}
