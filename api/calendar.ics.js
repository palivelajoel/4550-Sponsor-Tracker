import { d1Select } from './_gateway.js';

function icalEscape(text) {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatDate(dateStr, allDay = true) {
  const d = new Date(dateStr + (allDay ? 'T00:00:00' : ''));
  return allDay
    ? d.toISOString().replace(/[-:]/g, '').split('T')[0]
    : d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildICS(events, tasks) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FRC 4550//Team Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLIC',
    'X-WR-CALNAME:FRC 4550 Team Calendar',
    'X-WR-CALDESC:FRC Team 4550 events, to-dos, and task deadlines',
  ];

  for (const ev of events) {
    const uid = `ev-${ev.id}@frc4550`;
    const start = formatDate(ev.date, !!ev.all_day);
    const end = ev.end_date
      ? formatDate(ev.end_date, !!ev.all_day)
      : formatDate(ev.date, !!ev.all_day);
    const dtStart = ev.all_day ? `;VALUE=DATE:${start}` : `:${start}`;
    const dtEnd = ev.all_day ? `;VALUE=DATE:${end}` : `:${end}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART${dtStart}`,
      `DTEND${dtEnd}`,
      `SUMMARY:${icalEscape(ev.title)}`,
      ev.description ? `DESCRIPTION:${icalEscape(ev.description)}` : '',
      ev.type ? `CATEGORIES:${icalEscape(ev.type)}` : '',
      ev.time ? `DTSTART:${formatDate(ev.date, false)}T${ev.time.replace(':', '')}00` : '',
      'END:VEVENT',
    );
  }

  for (const task of tasks) {
    const uid = `task-${task.id}@frc4550`;
    const hasTime = !!task.due_time;
    const startDate = task.due_date;
    const start = hasTime ? `${formatDate(startDate, false).slice(0,9)}T${task.due_time.replace(':', '')}00` : formatDate(startDate, true);
    const end = hasTime ? `${formatDate(startDate, false).slice(0,9)}T${(task.due_time.slice(0,2) * 1 + 1).toString().padStart(2,'0')}${task.due_time.slice(2)}` : formatDate(startDate, true);
    const desc = `Status: ${task.status}\nPriority: ${task.priority}${task.assigned_name ? `\nAssigned to: ${task.assigned_name}` : ''}${task.subteam && task.subteam !== 'All' ? `\nSubteam: ${task.subteam}` : ''}${task.description ? `\n\n${task.description}` : ''}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      hasTime ? `DTSTART:${start}` : `DTSTART;VALUE=DATE:${start}`,
      hasTime ? `DTEND:${end}` : `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icalEscape(task.title)}`,
      `DESCRIPTION:${icalEscape(desc)}`,
      'CATEGORIES:Task',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

export default async function handler(req, res) {
  try {
    const [events, tasks] = await Promise.all([
      d1Select('hub_calendar', { order: [{ col: 'date', asc: true }] }),
      d1Select('hub_tasks', { filters: [{ col: 'due_date', op: 'not.is', value: null }], order: [{ col: 'due_date', asc: true }] }),
    ]);

    const ics = buildICS(events || [], tasks || []);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="frc4550-calendar.ics"');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(ics);
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
