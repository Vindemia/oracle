import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import type { Quadrant, Tag, Task } from '../types/index.js';
import { todayKey } from '../utils/dates.js';
import { STAR_PULSE_EVENT } from '../utils/animations.js';
import { rollRevelation } from '../utils/revelations.js';
import { useToast } from '../context/ToastContext.js';

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
  planTask: (id: string, date: string) => Promise<void>;
  unplanTask: (id: string) => Promise<void>;
  reactivateTask: (id: string) => Promise<void>;
  starTask: (id: string) => Promise<void>;
  unstarTask: (id: string) => Promise<void>;
  addStep: (taskId: string, title: string) => Promise<void>;
  toggleStep: (taskId: string, stepId: string) => Promise<void>;
  removeStep: (taskId: string, stepId: string) => Promise<void>;
}

export function useTasks(): UseTasksResult {
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const tasks = useMemo(() => {
    return [...rawTasks].sort((a, b) => {
      if (a.quadrant !== b.quadrant) return 0;
      // Dans le Brasier : tâches non-planifiées avant les tâches promues (plannedFor non null)
      if (a.quadrant === 'FIRE') {
        const aPromoted = a.plannedFor !== null ? 1 : 0;
        const bPromoted = b.plannedFor !== null ? 1 : 0;
        if (aPromoted !== bPromoted) return aPromoted - bPromoted;
      }
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

  // Déclenche un refresh automatique quand la prochaine tâche planifiée arrive à échéance
  useEffect(() => {
    const now = Date.now();
    const next = rawTasks
      .filter((t): t is typeof t & { plannedFor: string } => t.plannedFor !== null && new Date(t.plannedFor).getTime() > now)
      .map((t) => new Date(t.plannedFor).getTime())
      .sort((a, b) => a - b)[0];

    if (!next) return;

    const timer = setTimeout(fetchTasks, next - now);
    return () => { clearTimeout(timer); };
  }, [rawTasks, fetchTasks]);

  // Renforcement immédiat (v3-05) : point de câblage unique et centralisé —
  // toute complétion (Matrix, Focus…) passe par ici, donc un seul endroit
  // écoute/déclenche l'animation d'étoile et le tirage de révélation rare.
  const completeTask = useCallback(async (id: string) => {
    const prev = rawTasks;
    setRawTasks((t) => t.filter((task) => task.id !== id));
    try {
      await api.post<Task>('/tasks/' + id + '/complete', {});
      window.dispatchEvent(new Event(STAR_PULSE_EVENT));
      const revelation = rollRevelation();
      if (revelation !== null) {
        showToast(`✦ Révélation — ${revelation}`, 'special', { durationMs: 5000 });
      }
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks, showToast]);

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

  // Annulation (v3-17) : la tâche n'est déjà plus dans `rawTasks` (ce hook ne
  // suit que les tâches ACTIVE) — rien à retirer en optimistic, juste à
  // réinsérer une fois le serveur confirmé, quadrant/position d'origine intacts.
  const reactivateTask = useCallback(async (id: string) => {
    const task = await api.post<Task>('/tasks/' + id + '/reactivate', {});
    setRawTasks((t) => [...t, task]);
  }, []);

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

  const planTask = useCallback(async (id: string, date: string) => {
    const prev = rawTasks;
    setRawTasks((t) => t.map((task) => task.id === id ? { ...task, plannedFor: date } : task));
    try {
      await api.post<Task>('/tasks/' + id + '/plan', { plannedFor: date });
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  const unplanTask = useCallback(async (id: string) => {
    const prev = rawTasks;
    setRawTasks((t) => t.map((task) => task.id === id ? { ...task, plannedFor: null } : task));
    try {
      await api.post<Task>('/tasks/' + id + '/unplan', {});
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  // Étoiles du jour (v3-03). La limite de 3 est arbitrée par le serveur : en cas
  // de refus, le rollback remet la vision non étoilée et l'erreur remonte.
  const starTask = useCallback(async (id: string) => {
    const prev = rawTasks;
    setRawTasks((ts) => ts.map((task) => task.id === id ? { ...task, starredOn: todayKey() } : task));
    try {
      const updated = await api.post<Task>('/tasks/' + id + '/star', {});
      setRawTasks((ts) => ts.map((task) => task.id === id ? updated : task));
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  const unstarTask = useCallback(async (id: string) => {
    const prev = rawTasks;
    setRawTasks((ts) => ts.map((task) => task.id === id ? { ...task, starredOn: null } : task));
    try {
      await api.post<Task>('/tasks/' + id + '/unstar', {});
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  // Position provisoire — écrasée par la réponse serveur (id + position définitifs)
  // dès que la requête aboutit ; cf. rollback identique aux autres mutations.
  const addStep = useCallback(async (taskId: string, title: string) => {
    const prev = rawTasks;
    const tempId = 'temp-step-' + Date.now().toString();
    setRawTasks((ts) => ts.map((task) => task.id !== taskId
      ? task
      : { ...task, steps: [...task.steps, { id: tempId, title, done: false, position: task.steps.length }] }));
    try {
      const updated = await api.post<Task>('/tasks/' + taskId + '/steps', { title });
      setRawTasks((ts) => ts.map((task) => task.id === taskId ? updated : task));
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  const toggleStep = useCallback(async (taskId: string, stepId: string) => {
    const prev = rawTasks;
    const step = prev.find((t) => t.id === taskId)?.steps.find((s) => s.id === stepId);
    const nextDone = step ? !step.done : true;
    setRawTasks((ts) => ts.map((task) => task.id !== taskId
      ? task
      : { ...task, steps: task.steps.map((s) => s.id === stepId ? { ...s, done: nextDone } : s) }));
    try {
      await api.patch<Task>('/tasks/' + taskId + '/steps/' + stepId, { done: nextDone });
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  const removeStep = useCallback(async (taskId: string, stepId: string) => {
    const prev = rawTasks;
    setRawTasks((ts) => ts.map((task) => task.id !== taskId
      ? task
      : { ...task, steps: task.steps.filter((s) => s.id !== stepId) }));
    try {
      await api.delete<Task>('/tasks/' + taskId + '/steps/' + stepId);
    } catch (err) {
      setRawTasks(prev);
      throw err;
    }
  }, [rawTasks]);

  return {
    tasks, isLoading, error, refresh: fetchTasks,
    completeTask, eliminateTask, updateTask, updateTaskTags, deleteTask,
    reorderTasks, planTask, unplanTask, reactivateTask,
    starTask, unstarTask,
    addStep, toggleStep, removeStep,
  };
}
