import { createClient } from '@supabase/supabase-js';

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
    const start = formatDate(task.due_date, true);
    const end = formatDate(task.due_date, true);
    const desc = `Status: ${task.status}\nPriority: ${task.priority}${task.assigned_name ? `\nAssigned to: ${task.assigned_name}` : ''}${task.subteam && task.subteam !== 'All' ? `\nSubteam: ${task.subteam}` : ''}${task.description ? `\n\n${task.description}` : ''}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
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
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  try {
    const [evRes, taskRes] = await Promise.all([
      supabase.from('hub_calendar').select('*').order('date', { ascending: true }),
      supabase.from('hub_tasks').select('*').not('due_date', 'is', null).order('due_date', { ascending: true }),
    ]);

    const events = evRes.data || [];
    const tasks = taskRes.data || [];

    const ics = buildICS(events, tasks);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="frc4550-calendar.ics"');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(ics);
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
