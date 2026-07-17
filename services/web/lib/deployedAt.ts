/**
 * Format a deploy timestamp for the version banner. The API sends SQLite's UTC `CURRENT_TIMESTAMP`
 * (`YYYY-MM-DD HH:MM:SS`, no zone); an ISO string is also accepted. A date-time that carries no
 * timezone is treated as UTC (rather than the viewer's local zone, which is how bare `new Date`
 * would read it), and the result is always rendered in UTC — so the banner reads identically for
 * every viewer regardless of their local timezone. A string that already carries a zone (`Z` or an
 * offset) is respected as-is. An unparseable value falls back to the raw string rather than throwing
 * on a public page.
 */
export function formatDeployedAt(raw: string): string {
  // Pin a zone-less date-time (SQLite's space form or a bare ISO) to UTC so Date parses it
  // deterministically; leave a zone-bearing or non-datetime string untouched.
  const zoneless = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;
  const iso = zoneless.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
