/** Session dates are stored as UTC midnight, so always format them in UTC. */
export function formatDate(date: Date, style: "medium" | "short" = "medium") {
  return date.toLocaleDateString("en-GB", { timeZone: "UTC", dateStyle: style });
}

/** Parses a YYYY-MM-DD form value into UTC midnight, or null. Rejects impossible dates like 2026-02-30. */
export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const day = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value ? null : day;
}
