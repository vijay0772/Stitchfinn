/**
 * All charts and usage date ranges use Central Time (Chicago).
 * This avoids mismatches when the server stores UTC and users are in different timezones.
 */
const CHICAGO_TZ = 'America/Chicago';

/** Today's date in Chicago as YYYY-MM-DD */
export function todayChicago(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: CHICAGO_TZ });
}

/** N days ago in Chicago as YYYY-MM-DD */
export function daysAgoChicago(days: number): string {
  const today = todayChicago();
  const [y, m, d] = today.split('-').map(Number);
  const utcNoon = Date.UTC(y, m - 1, d);
  const past = new Date(utcNoon - days * 24 * 60 * 60 * 1000);
  return past.toLocaleDateString('en-CA', { timeZone: CHICAGO_TZ });
}

/** Format YYYY-MM-DD for chart labels in Chicago (e.g. "Jan 28") */
export function formatDateChicago(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { timeZone: CHICAGO_TZ, month: 'short', day: '2-digit' });
}

function nextDayStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
}

/** List of date strings (YYYY-MM-DD) from fromStr to toStr inclusive */
export function dateRangeChicago(fromStr: string, toStr: string): string[] {
  const out: string[] = [];
  let current = fromStr;
  while (current <= toStr) {
    out.push(current);
    current = nextDayStr(current);
  }
  return out;
}
