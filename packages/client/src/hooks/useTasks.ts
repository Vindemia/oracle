import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { Task } from '../types/index.js';

interface UseTasksResult {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    setIsLoading(true);
    setError(null);
    api
      .get<Task[]>('/tasks?status=ACTIVE')
      .then((data) => { setTasks(data); })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      })
      .finally(() => { setIsLoading(false); });
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, isLoading, error, refresh: fetchTasks };
}
