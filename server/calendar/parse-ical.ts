import 'server-only';
import ICAL from 'ical.js';
import type { CalendarEvent } from '../../lib/ical-calendar.ts';

function dateProperty(component: InstanceType<typeof ICAL.Component>, name: string): string | null {
  const properties = component.getAllProperties(name);
  if (!properties.length) return null;
  if (properties.length !== 1) throw new Error('invalid_ics');
  // Validate the original digits before ICAL.Time can normalize an invalid date.
  const line = properties[0].toICALString();
  const raw = /;VALUE=DATE:(\d{4})(\d{2})(\d{2})$/i.exec(line);
  if (!raw) throw new Error('unsupported_ics');
  const date = `${raw[1]}-${raw[2]}-${raw[3]}`;
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new Error('invalid_ics');
  return date;
}

export function parseIcal(text: string): CalendarEvent[] {
  try {
    if (new TextEncoder().encode(text).length > 1_048_576) throw new Error('ical_too_large');
    const lines = text.trim().split(/\r?\n/);
    if (lines[0] !== 'BEGIN:VCALENDAR' || lines.at(-1) !== 'END:VCALENDAR'
      || lines.filter(line => line === 'BEGIN:VCALENDAR').length !== 1) throw new Error('invalid_ics');
    const stack:string[]=[];
    for(const line of text.trim().replace(/\r?\n[ \t]/g,'').split(/\r?\n/)){
      const marker=/^(BEGIN|END):([A-Z]+)$/i.exec(line);
      if(!marker)continue;
      const kind=marker[2].toUpperCase();
      if(marker[1].toUpperCase()==='END'){
        if(stack.pop()!==kind)throw new Error('invalid_ics');
      }else{
        const parent=stack.at(-1);
        if(!((kind==='VCALENDAR'&&!parent)||(parent==='VCALENDAR'&&['VEVENT','VTIMEZONE'].includes(kind))
          ||(parent==='VTIMEZONE'&&['STANDARD','DAYLIGHT'].includes(kind))))throw new Error('unsupported_ics');
        stack.push(kind);
      }
    }
    if(stack.length)throw new Error('invalid_ics');
    const root = ICAL.Component.fromString(text);
    if (root.name !== 'vcalendar' || root.getFirstPropertyValue('version') !== '2.0') throw new Error('invalid_ics');
    const methods = root.getAllProperties('method');
    if (methods.length > 1 || (methods.length === 1 && root.getFirstPropertyValue('method') !== 'PUBLISH')) throw new Error('unsupported_ics');
    const components = root.getAllSubcomponents('vevent');
    if (components.length > 5000) throw new Error('ical_too_large');
    const events = new Map<string, CalendarEvent>();
    for (const component of components) {
      for (const name of ['rrule', 'rdate', 'exdate', 'recurrence-id', 'duration']) {
        if (component.hasProperty(name)) throw new Error('unsupported_ics');
      }
      const uid: unknown = component.getFirstPropertyValue('uid');
      if (component.getAllProperties('uid').length !== 1 || typeof uid !== 'string' || !uid.trim() || uid.length > 1024) throw new Error('invalid_ics');
      const statuses = component.getAllProperties('status');
      if (statuses.length > 1) throw new Error('invalid_ics');
      const status: unknown = component.getFirstPropertyValue('status');
      if (status != null && !['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(String(status).toUpperCase())) throw new Error('unsupported_ics');
      let event: CalendarEvent;
      if (String(status).toUpperCase() === 'CANCELLED') event = { uid, status: 'cancelled' };
      else {
        const start = dateProperty(component, 'dtstart');
        if (!start) throw new Error('invalid_ics');
        const endExclusive = dateProperty(component, 'dtend') ?? new Date(Date.parse(`${start}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endExclusive) || endExclusive <= start) throw new Error('invalid_ics');
        event = { uid, status: 'active', start, endExclusive };
      }
      const previous = events.get(uid);
      if (previous && JSON.stringify(previous) !== JSON.stringify(event)) throw new Error('invalid_ics');
      events.set(uid, event);
    }
    return [...events.values()];
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    throw new Error(['invalid_ics', 'unsupported_ics', 'ical_too_large'].includes(code) ? code : 'invalid_ics');
  }
}
