// RFC 5545 calendar entries for "Naptárba teszem" (SPEC §11.7). All-day events for deadlines,
import brand from '../_shared/brand.json' with { type: 'json' };
// timed events (UTC) for appointments.
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function icsFor(e: { uid: string; title: string; date?: string; start?: Date; end?: Date; description?: string; now: Date }): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${brand.provider.legalName}//${brand.ids.appScheme}//HU`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp(e.now)}`];
  if (e.date) {
    const d = e.date.replace(/-/g, '');
    const next = new Date(`${e.date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`);
  } else if (e.start && e.end) {
    lines.push(`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`);
  }
  lines.push(`SUMMARY:${esc(e.title)}`);
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, e.date ? 'TRIGGER:-P2D' : 'TRIGGER:-PT1H', 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
