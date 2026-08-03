import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { ConstellationData } from '../types/index.js';

function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear().toString()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + delta, 1));
  return `${date.getUTCFullYear().toString()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
}

interface UseConstellationResult {
  data: ConstellationData | null;
  isLoading: boolean;
  monthKey: string;
  isCurrentMonth: boolean;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
}

/**
 * Constellation (v3-05) — charge l'agrégat du mois local demandé. Les vieux
 * ciels restent visitables : la navigation change juste le paramètre `month`.
 */
export function useConstellation(): UseConstellationResult {
  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [data, setData] = useState<ConstellationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    api
      .get<ConstellationData>(`/constellation?month=${monthKey}`)
      .then((res) => { setData(res); })
      .catch(() => { setData(null); })
      .finally(() => { setIsLoading(false); });
  }, [monthKey]);

  return {
    data,
    isLoading,
    monthKey,
    isCurrentMonth: monthKey === currentMonthKey(),
    goToPreviousMonth: () => { setMonthKey((k) => shiftMonthKey(k, -1)); },
    goToNextMonth: () => { setMonthKey((k) => shiftMonthKey(k, 1)); },
  };
}
