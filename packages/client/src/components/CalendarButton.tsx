import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types/index.js';
import styles from './CalendarButton.module.css';

interface CalendarButtonProps {
  task: Task;
}

export function toGCalDate(iso: string): string {
  return iso.replace(/[-:]/g, '').replace('.000Z', 'Z').replace(/\.\d{3}Z$/, 'Z');
}

export function buildGoogleCalUrl(task: Task): string {
  if (!task.plannedFor) return '';
  const start = toGCalDate(task.plannedFor);
  const endDate = new Date(new Date(task.plannedFor).getTime() + 60 * 60 * 1000);
  const end = toGCalDate(endDate.toISOString());
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(task.title)
    + '&dates=' + start + '/' + end
    + (task.notes ? '&details=' + encodeURIComponent(task.notes) : '');
}

export function downloadIcal(task: Task): void {
  if (!task.plannedFor) return;
  const start = toGCalDate(task.plannedFor);
  const endDate = new Date(new Date(task.plannedFor).getTime() + 60 * 60 * 1000);
  const end = toGCalDate(endDate.toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Oracle//Oracle//FR',
    'BEGIN:VEVENT',
    'UID:' + task.id + '@oracle',
    'DTSTART:' + start,
    'DTEND:' + end,
    'SUMMARY:' + task.title,
    task.notes ? 'DESCRIPTION:' + task.notes : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'oracle-' + task.title.toLowerCase().replace(/\s+/g, '-').slice(0, 40) + '.ics';
  a.click();
  URL.revokeObjectURL(url);
}

export function CalendarButton({ task }: CalendarButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  if (!task.plannedFor) return null;

  return (
    <div ref={ref} className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label="Ajouter à l'agenda"
        title="Ajouter à l'agenda"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M5 10h2m2 0h2M5 12.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className={styles.dropdown}>
          <a
            href={buildGoogleCalUrl(task)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.option}
            onClick={() => { setOpen(false); }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Google Agenda
          </a>
          <button
            type="button"
            className={styles.option}
            onClick={(e) => { e.stopPropagation(); downloadIcal(task); setOpen(false); }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v8m0 0-3-3m3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Télécharger (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
