import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { Feedback, FeedbackKind } from '../types/index.js';

interface SendFeedbackInput {
  kind: FeedbackKind;
  message: string;
  context?: Record<string, unknown>;
}

interface UseFeedbackResult {
  mine: Feedback[];
  isLoading: boolean;
  sendFeedback: (input: SendFeedbackInput) => Promise<Feedback>;
}

/** Échos envoyés par l'utilisatrice courante — persistés puis, en tâche de fond, transformés en issue GitHub. */
export function useFeedback(): UseFeedbackResult {
  const [mine, setMine] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<Feedback[]>('/feedback/mine')
      .then((data) => { setMine(data); })
      .catch(() => { /* silencieux : l'historique des échos est secondaire */ })
      .finally(() => { setIsLoading(false); });
  }, []);

  const sendFeedback = useCallback(async (input: SendFeedbackInput) => {
    const feedback = await api.post<Feedback>('/feedback', input);
    setMine((prev) => [feedback, ...prev]);
    return feedback;
  }, []);

  return { mine, isLoading, sendFeedback };
}
