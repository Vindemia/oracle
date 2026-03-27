import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { Tag, Task } from '../types/index.js';

interface UseTasksResult {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  completeTask: (id: string) => Promise<void>;
  eliminateTask: (id: string) => Promise<void>;
  updateTask: (id: string, data: Partial<Pick<Task, 'urgent' | 'important' | 'title'>>) => Promise<void>;
  updateTaskTags: (id: string, newTags: Tag[]) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
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

  const completeTask = useCallback(async (id: string) => {
    const prev = tasks;
    setTasks((t) => t.filter((task) => task.id !== id));
    try {
      await api.post<Task>('/tasks/' + id + '/complete', {});
    } catch (err) {
      setTasks(prev);
      throw err;
    }
  }, [tasks]);

  const eliminateTask = useCallback(async (id: string) => {
    const prev = tasks;
    setTasks((t) => t.filter((task) => task.id !== id));
    try {
      await api.post<Task>('/tasks/' + id + '/eliminate', {});
    } catch (err) {
      setTasks(prev);
      throw err;
    }
  }, [tasks]);

  const updateTask = useCallback(async (
    id: string,
    data: Partial<Pick<Task, 'urgent' | 'important' | 'title'>>,
  ) => {
    const prev = tasks;
    setTasks((t) =>
      t.map((task) => {
        if (task.id !== id) return task;
        const urgent = data.urgent ?? task.urgent;
        const important = data.important ?? task.important;
        let quadrant = task.quadrant;
        if (data.urgent !== undefined || data.important !== undefined) {
          if (urgent && important) quadrant = 'FIRE';
          else if (!urgent && important) quadrant = 'STARS';
          else if (urgent && !important) quadrant = 'WIND';
          else quadrant = 'MIST';
        }
        return { ...task, ...data, quadrant };
      }),
    );
    try {
      await api.patch<Task>('/tasks/' + id, data);
    } catch (err) {
      setTasks(prev);
      throw err;
    }
  }, [tasks]);

  const updateTaskTags = useCallback(async (id: string, newTags: Tag[]) => {
    const prev = tasks;
    setTasks((t) => t.map((task) => task.id !== id ? task : { ...task, tags: newTags }));
    try {
      await api.patch<Task>('/tasks/' + id, { tagIds: newTags.map((t) => t.id) });
    } catch (err) {
      setTasks(prev);
      throw err;
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    const prev = tasks;
    setTasks((t) => t.filter((task) => task.id !== id));
    try {
      await api.delete<undefined>('/tasks/' + id);
    } catch (err) {
      setTasks(prev);
      throw err;
    }
  }, [tasks]);

  return { tasks, isLoading, error, refresh: fetchTasks, completeTask, eliminateTask, updateTask, updateTaskTags, deleteTask };
}
