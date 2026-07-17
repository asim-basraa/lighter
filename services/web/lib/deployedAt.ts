/**
 * Format a deploy timestamp for the version banner. The API sends SQLite's UTC `CURRENT_TIMESTAMP`
 * (`YYYY-MM-DD HH:MM:SS`, no zone) or an ISO string; both are treated as UTC and rendered in UTC so
 * the banner reads identically for every viewer regardless of their local timezone. An unparseable
 * value falls back to the raw string rather than throwing on a public page.
 */
export function formatDeployedAt(raw: string): string {
  // Normalize the space-separated SQLite form to ISO-UTC so Date parses it deterministically.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
