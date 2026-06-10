// Génération iCal côté serveur — port multi-événements de la logique
// ponctuelle de packages/client/src/components/CalendarButton.tsx.

export interface CalendarEvent {
  id: string;
  title: string;
  notes: string | null;
  plannedFor: Date;
}

const EVENT_DURATION_MS = 60 * 60 * 1000;

function toICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// RFC 5545 : échapper backslash, point-virgule, virgule et retours à la ligne.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildCalendar(events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Oracle//Oracle//FR',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Oracle',
  ];

  for (const event of events) {
    const start = toICalDate(event.plannedFor);
    const end = toICalDate(new Date(event.plannedFor.getTime() + EVENT_DURATION_MS));
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@oracle`,
      `DTSTAMP:${start}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(event.title)}`,
    );
    if (event.notes !== null && event.notes !== '') {
      lines.push(`DESCRIPTION:${escapeText(event.notes)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
