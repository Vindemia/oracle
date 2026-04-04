import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import type { Quadrant, Tag, Task } from '../types/index.js';

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
  reorderTasks: (quadrant: Quadrant, orderedIds: string[]) => Promise<void>;
}

export function useTasks(): UseTasksResult {
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tasks = useMemo(() => {
    return [...rawTasks].sort((a, b) => {
      if (a.quadrant !== b.quadrant) return 0;
      return a.position - b.position;
    });
  }, [rawTasks]);

  const fetchTasks = useCallback(() => {
    setIsLoading(true);
    setError(null);
    api
      .get<Task[]>('/tasks?status=ACTIVE')
      .then((data) => { setRawTasks(data); })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      })
      .finally(() => { setIsLoading(false); });
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const completeTask = useCallback(async (id: string) => {
    const prev = rawTasks;
    setRawTasks((t) => t.filter((task) => task.id !== id));
    try {
      await api.post<Task>('/tasks/' + id + '/complete', {});
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  const eliminateTask = useCallback(async (id: string) => {
    const prev = rawTasks;
    setRawTasks((t) => t.filter((task) => task.id !== id));
    try {
      await api.post<Task>('/tasks/' + id + '/eliminate', {});
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  const updateTask = useCallback(async (
    id: string,
    data: Partial<Pick<Task, 'urgent' | 'important' | 'title'>>,
  ) => {
    const prev = rawTasks;
    setRawTasks((t) =>
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
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  const updateTaskTags = useCallback(async (id: string, newTags: Tag[]) => {
    const prev = rawTasks;
    setRawTasks((t) => t.map((task) => task.id !== id ? task : { ...task, tags: newTags }));
    try {
      await api.patch<Task>('/tasks/' + id, { tagIds: newTags.map((t) => t.id) });
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  const deleteTask = useCallback(async (id: string) => {
    const prev = rawTasks;
    setRawTasks((t) => t.filter((task) => task.id !== id));
    try {
      await api.delete<undefined>('/tasks/' + id);
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  const reorderTasks = useCallback(async (quadrant: Quadrant, orderedIds: string[]) => {
    const prev = rawTasks;
    setRawTasks((t) =>
      t.map((task) => {
        if (task.quadrant !== quadrant) return task;
        const idx = orderedIds.indexOf(task.id);
        return idx === -1 ? task : { ...task, position: idx };
      }),
    );
    try {
      await api.post<{ success: boolean }>(
        '/tasks/reorder',
        orderedIds.map((id, i) => ({ id, position: i })),
      );
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  return { tasks, isLoading, error, refresh: fetchTasks, completeTask, eliminateTask, updateTask, updateTaskTags, deleteTask, reorderTasks };
}
