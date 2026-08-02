import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { RitualStatus } from '../types/index.js';

interface UseRitualResult {
  status: RitualStatus | null;
  isLoading: boolean;
  complete: () => Promise<void>;
}

/**
 * Rituel de l'Aube (v3-03) — check-in quotidien. Le statut est chargé une fois
 * au montage : le rituel ne se rappelle jamais à l'utilisateur en cours de
 * journée, seul le pastille du header signale qu'il reste à faire.
 */
export function useRitual(): UseRitualResult {
  const [status, setStatus] = useState<RitualStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<RitualStatus>('/ritual/status')
      .then((data) => { setStatus(data); })
      .catch(() => { /* silencieux : sans statut, aucun rappel affiché */ })
      .finally(() => { setIsLoading(false); });
  }, []);

  const complete = useCallback(async () => {
    await api.post<{ ritualDoneToday: boolean }>('/ritual/complete', {});
    setStatus((s) => s === null ? s : { ...s, ritualDoneToday: true });
  }, []);

  return { status, isLoading, complete };
}
