import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { Task, Whisper } from '../types/index.js';

interface RevealInput {
  urgent: boolean;
  important: boolean;
  tagIds?: string[];
}

interface UseWhispersResult {
  whispers: Whisper[];
  isLoading: boolean;
  capture: (text: string) => Promise<void>;
  reveal: (id: string, input: RevealInput) => Promise<Task>;
  dismiss: (id: string) => Promise<void>;
}

/** Murmures en attente de tri — capture brute, tri différé au Rituel de l'Aube (v3-03). */
export function useWhispers(): UseWhispersResult {
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<Whisper[]>('/whispers')
      .then((data) => { setWhispers(data); })
      .catch(() => { /* silencieux : le badge reste à 0, capture() reste disponible */ })
      .finally(() => { setIsLoading(false); });
  }, []);

  const capture = useCallback(async (text: string) => {
    const prev = whispers;
    const tempId = 'temp-' + Date.now().toString();
    const optimistic: Whisper = { id: tempId, text, createdAt: new Date().toISOString() };
    setWhispers((w) => [...w, optimistic]);
    try {
      const created = await api.post<Whisper>('/whispers', { text });
      setWhispers((w) => w.map((whisper) => whisper.id === tempId ? created : whisper));
    } catch (err) {
      setWhispers(prev);
      throw err;
    }
  }, [whispers]);

  const reveal = useCallback(async (id: string, input: RevealInput) => {
    const prev = whispers;
    setWhispers((w) => w.filter((whisper) => whisper.id !== id));
    try {
      return await api.post<Task>('/whispers/' + id + '/reveal', input);
    } catch (err) {
      setWhispers(prev);
      throw err;
    }
  }, [whispers]);

  const dismiss = useCallback(async (id: string) => {
    const prev = whispers;
    setWhispers((w) => w.filter((whisper) => whisper.id !== id));
    try {
      await api.delete<undefined>('/whispers/' + id);
    } catch (err) {
      setWhispers(prev);
      throw err;
    }
  }, [whispers]);

  return { whispers, isLoading, capture, reveal, dismiss };
}
