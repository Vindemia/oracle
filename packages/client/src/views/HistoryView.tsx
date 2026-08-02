import { useEffect, useState } from 'react';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { api } from '../api/client.js';
import { getQuadrantMeta, getQuadrantTermKey } from '../utils/quadrant.js';
import { useTheme } from '../context/ThemeContext.js';
import type { Task } from '../types/index.js';
import styles from './HistoryView.module.css';

const PAGE_SIZE = 20;

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupByDay(tasks: Task[]): Array<{ label: string; date: string; tasks: Task[] }> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const completedAt = task.completedAt ?? task.updatedAt;
    const date = new Date(completedAt);
    const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    const group = groups.get(key) ?? [];
    group.push(task);
    groups.set(key, group);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, groupTasks]) => ({
      label: formatDayLabel(key),
      date: key,
      tasks: groupTasks,
    }));
}

export function HistoryView() {
  const { theme, t } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      api.get<Task[]>('/tasks?status=DONE'),
      api.get<Task[]>('/tasks?status=ELIMINATED'),
    ])
      .then(([done, eliminated]) => {
        const all = [...done, ...eliminated].sort((a, b) => {
          const ta = a.completedAt ?? a.updatedAt;
          const tb = b.completedAt ?? b.updatedAt;
          return tb.localeCompare(ta);
        });
        const firstPage = all.slice(0, PAGE_SIZE);
        setTasks(firstPage);
        setHasMore(all.length > PAGE_SIZE);
        // Store full list reference for pagination
        sessionStorage.setItem('oracle:history', JSON.stringify(all));
      })
      .catch(() => { setError('Erreur lors du chargement de l\'historique'); })
      .finally(() => { setIsLoading(false); });
  }, []);

  // Annulation (v3-17) — filet permanent, sans limite de temps : remet la
  // tâche à sa place d'origine (quadrant/position jamais touchés par
  // complete/eliminate) et la retire localement sans re-fetch complet.
  const handleReactivate = async (id: string) => {
    if (reactivatingId !== null) return;
    setReactivatingId(id);
    try {
      await api.post<Task>('/tasks/' + id + '/reactivate', {});
      setTasks((t) => t.filter((task) => task.id !== id));
      const raw = sessionStorage.getItem('oracle:history');
      if (raw) {
        const all = (JSON.parse(raw) as Task[]).filter((task) => task.id !== id);
        sessionStorage.setItem('oracle:history', JSON.stringify(all));
      }
    } catch {
      // Le bouton reste actif, l'utilisateur peut retenter.
    } finally {
      setReactivatingId(null);
    }
  };

  const loadMore = () => {
    const raw = sessionStorage.getItem('oracle:history');
    if (!raw) return;
    const all = JSON.parse(raw) as Task[];
    const nextPage = page + 1;
    const nextSlice = all.slice(0, (nextPage + 1) * PAGE_SIZE);
    setTasks(nextSlice);
    setPage(nextPage);
    setHasMore(all.length > (nextPage + 1) * PAGE_SIZE);
  };

  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const groups = groupByDay(tasks);

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        {isLoading ? (
          <div className={styles.feedback}>Consultation des archives…</div>
        ) : error !== null ? (
          <div className={[styles.feedback, styles.error].join(' ')}>{error}</div>
        ) : (
          <>
            <div className={styles.counter}>
              {theme.ornaments && <span className={styles.counterIcon}>✦</span>}
              <span>
                {doneCount.toString()} {t('task')}{doneCount !== 1 ? 's' : ''}{' '}
                {t('tasksAccomplishedSuffix')}{doneCount !== 1 ? 's' : ''}
              </span>
            </div>

            {groups.length === 0 ? (
              <div className={styles.feedback}>{t('historyEmpty')}</div>
            ) : (
              groups.map((group) => (
                <section key={group.date} className={styles.dayGroup}>
                  <h2 className={styles.dayLabel}>{group.label}</h2>
                  <ul className={styles.taskList}>
                    {group.tasks.map((task) => {
                      const meta = getQuadrantMeta(task.quadrant);
                      const quadrantLabel = t(getQuadrantTermKey(task.quadrant));
                      return (
                        <li key={task.id} className={styles.taskItem}>
                          {theme.ornaments ? (
                            <span className={styles.quadrantIcon} title={quadrantLabel}>
                              {meta.icon}
                            </span>
                          ) : (
                            <span
                              className={styles.quadrantDot}
                              title={quadrantLabel}
                              style={{ backgroundColor: `var(${meta.colorVar})` }}
                            />
                          )}
                          <span className={[styles.taskTitle, task.status === 'ELIMINATED' ? styles.eliminated : undefined].filter(Boolean).join(' ')}>
                            {task.title}
                          </span>
                          {task.tags.length > 0 && (
                            <div className={styles.tags}>
                              {task.tags.map((tag) => (
                                <span key={tag.id} className={styles.tag}>{tag.name}</span>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            className={styles.reactivateBtn}
                            disabled={reactivatingId === task.id}
                            onClick={() => { void handleReactivate(task.id); }}
                            aria-label={'Remettre en place : ' + task.title}
                            title="Remettre en place"
                          >
                            <ArrowCounterClockwiseIcon size={15} weight="bold" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}

            {hasMore && (
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={loadMore}
              >
                Charger plus
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
