// ─── Date helpers ────────────────────────────────────────────────────────────

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Returns Mon–Sun of the week containing `date`. */
export function getDaysForView(date: Date, mode: 'day' | 'week'): Date[] {
  if (mode === 'day') return [startOfDay(date)];
  const dow = date.getDay(); // 0=Sun
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return startOfDay(d);
  });
}

// ─── Time ↔ Pixel conversions ─────────────────────────────────────────────────

/** `top` offset in px from top of day column (midnight = 0). */
export function timeToPx(epochMs: number, dayStart: Date, hourHeight: number): number {
  const offsetMs = epochMs - dayStart.getTime();
  return (offsetMs / 3_600_000) * hourHeight;
}

/** Epoch ms from a px offset in a day column. */
export function pxToTime(px: number, dayStart: Date, hourHeight: number): number {
  const offsetHours = px / hourHeight;
  return dayStart.getTime() + offsetHours * 3_600_000;
}

/** Snap epoch ms to the nearest `snap`-minute boundary. */
export function snapToMinutes(epochMs: number, snap = 15): number {
  const snapMs = snap * 60_000;
  return Math.round(epochMs / snapMs) * snapMs;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Formats epoch ms for `<input type="datetime-local">` value. */
export function formatDateTimeLocal(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses a `datetime-local` string value back to epoch ms. */
export function parseDateTimeLocal(s: string): number {
  return new Date(s).getTime();
}

/** Format duration in seconds as "1h 23m" or "45m". */
export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export { DAY_NAMES_SHORT };

export function formatDayHeader(date: Date): string {
  return `${DAY_NAMES_SHORT[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatDateRange(date: Date, mode: 'day' | 'week'): string {
  if (mode === 'day') {
    return `${DAY_NAMES_FULL[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
  const days = getDaysForView(date, 'week');
  const first = days[0];
  const last = days[6];
  if (first.getMonth() === last.getMonth()) {
    return `${MONTH_NAMES_SHORT[first.getMonth()]} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`;
  }
  return `${MONTH_NAMES_SHORT[first.getMonth()]} ${first.getDate()} – ${MONTH_NAMES_SHORT[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
}

// ─── CalendarEntry type ───────────────────────────────────────────────────────

export interface CalendarEntry {
  id: string;       // time_entry id
  taskId: string;
  taskTitle: string;
  color: string;    // derived from project color or default blue
  startTime: number; // epoch ms
  endTime: number;   // epoch ms — for active entries this is updated to Date.now()
  isActive: boolean; // currently running timer
}

// ─── Simple overlap layout ────────────────────────────────────────────────────

export interface LayoutEntry {
  entry: CalendarEntry;
  col: number;
  colCount: number;
}

/** Assigns non-overlapping columns to each entry for side-by-side display. */
export function layoutDayEntries(entries: CalendarEntry[]): LayoutEntry[] {
  const sorted = [...entries].sort((a, b) => a.startTime - b.startTime);
  const cols: number[] = []; // cols[i] = endTime of the last entry placed in column i
  const assigned: { entry: CalendarEntry; col: number }[] = [];

  for (const entry of sorted) {
    // Find the first column whose last entry has ended before this one starts
    let assignedCol = cols.findIndex((colEnd) => colEnd <= entry.startTime);
    if (assignedCol === -1) {
      assignedCol = cols.length;
      cols.push(entry.endTime);
    } else {
      cols[assignedCol] = entry.endTime;
    }
    assigned.push({ entry, col: assignedCol });
  }

  // For each entry, colCount = (max col index among entries that overlap it) + 1
  // This way non-overlapping entries keep full width while overlapping ones share it.
  const MAX_COLS = 4;
  return assigned.map(({ entry, col }) => {
    const maxCol = assigned
      .filter(({ entry: other }) => other.startTime < entry.endTime && other.endTime > entry.startTime)
      .reduce((max, { col: c }) => Math.max(max, c), 0);
    const finalColCount = Math.min(maxCol + 1, MAX_COLS);
    const finalCol = Math.min(col, MAX_COLS - 1);
    return { entry, col: finalCol, colCount: finalColCount };
  });
}
