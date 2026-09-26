import { parseISO, addDays, getDay, format, setHours, setMinutes, isBefore, startOfDay } from 'date-fns';
import { Session, SessionStatus, Program } from '../types';
import { generateUUID } from './utils';

export interface GenerateSessionsOpts {
  organization_id: string;
  program_id: string;
  client_id: string;
  start_date: string; // YYYY-MM-DD or ISO
  weekly_days: number[]; // 0=Sun .. 6=Sat
  total_sessions: number;
  session_times?: string[]; // e.g. ["09:00", "19:00"]
  day_times?: Record<number, string[]>; // e.g. { 0: ["10:00"], 3: ["17:00"] }
  day_parts?: string[];
  morning_time?: string;
  noon_time?: string;
  evening_time?: string;
  session_time?: string;
  assigned_to?: string;
}

export function generateSessions(opts: GenerateSessionsOpts): Omit<Session, 'created_at'>[] {
  const {
    organization_id,
    program_id,
    client_id,
    start_date,
    weekly_days,
    total_sessions,
    assigned_to,
  } = opts;

  if (!weekly_days || weekly_days.length === 0 || total_sessions <= 0) {
    return [];
  }

  // Determine fallback times list
  let defaultTimes: string[] = [];
  if (opts.session_times && opts.session_times.length > 0) {
    defaultTimes = [...opts.session_times];
  } else if (opts.day_parts && opts.day_parts.length > 0) {
    opts.day_parts.forEach((part) => {
      if (part === 'morning') defaultTimes.push(opts.morning_time || '09:00');
      else if (part === 'noon') defaultTimes.push(opts.noon_time || '13:00');
      else if (part === 'evening') defaultTimes.push(opts.evening_time || '19:00');
    });
  } else if (opts.session_time) {
    defaultTimes.push(opts.session_time);
  } else {
    defaultTimes.push('10:00');
  }

  // De-duplicate & sort default times
  defaultTimes = Array.from(new Set(defaultTimes.filter(Boolean))).sort();

  const sessions: Omit<Session, 'created_at'>[] = [];
  let startDateObj = startOfDay(parseISO(start_date.split('T')[0]));
  let currDate = startDateObj;
  const maxDaysToScan = 365 * 3; // 3 years max scan
  let dayOffset = 0;

  while (sessions.length < total_sessions && dayOffset < maxDaysToScan) {
    const dayOfWeek = getDay(currDate); // 0 = Sun
    if (weekly_days.includes(dayOfWeek)) {
      // Check if day_times has custom times for this dayOfWeek
      let daySpecificTimes: string[] = [];
      if (opts.day_times && opts.day_times[dayOfWeek] && opts.day_times[dayOfWeek].length > 0) {
        daySpecificTimes = opts.day_times[dayOfWeek];
      } else {
        daySpecificTimes = defaultTimes;
      }

      daySpecificTimes = Array.from(new Set(daySpecificTimes.filter(Boolean))).sort();

      for (const t of daySpecificTimes) {
        if (sessions.length >= total_sessions) break;
        const [hh, mm] = t.split(':').map((n) => parseInt(n, 10) || 0);
        const sessionDateObj = setMinutes(setHours(currDate, hh), mm);

        sessions.push({
          id: generateUUID(),
          organization_id,
          program_id,
          client_id,
          session_date: sessionDateObj.toISOString(),
          status: 'scheduled' as SessionStatus,
          notes: '',
          audio_urls: [],
          image_urls: [],
          assigned_to: assigned_to || undefined,
        });
      }
    }
    currDate = addDays(currDate, 1);
    dayOffset++;
  }

  return sessions;
}

/**
 * Handle rescheduling a postponed session:
 * Finds the latest session in the program, then scans for the next available weekly day & time slot
 */
export function createRescheduledSession(
  existingSessions: Session[],
  program: Program
): Session | null {
  if (!program.weekly_days || program.weekly_days.length === 0) return null;

  // Find latest session date
  let latestDate = new Date();
  existingSessions.forEach((s) => {
    const sDate = parseISO(s.session_date);
    if (sDate > latestDate) {
      latestDate = sDate;
    }
  });

  const timeSlot = program.session_times?.[0] || program.session_time || '10:00';
  const [hh, mm] = timeSlot.split(':').map((n) => parseInt(n, 10) || 0);

  let searchDate = addDays(latestDate, 1);
  for (let i = 0; i < 365; i++) {
    const dow = getDay(searchDate);
    if (program.weekly_days.includes(dow)) {
      const newSessionDate = setMinutes(setHours(searchDate, hh), mm);
      return {
        id: generateUUID(),
        organization_id: program.organization_id,
        program_id: program.id,
        client_id: program.client_id,
        session_date: newSessionDate.toISOString(),
        status: 'scheduled',
        notes: 'מפגש חלופי בעקבות דחיית מפגש קודם',
        audio_urls: [],
        image_urls: [],
        assigned_to: program.assigned_to,
        created_at: new Date().toISOString(),
      };
    }
    searchDate = addDays(searchDate, 1);
  }

  return null;
}
