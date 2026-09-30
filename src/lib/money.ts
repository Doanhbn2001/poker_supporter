/** Parse a user-entered amount like "50" or "12.5" into integer cents. */
export function toCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

export function formatMoney(cents: number, { signed = false } = {}) {
  const abs = (Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (cents < 0) return `-${abs}`;
  return signed && cents > 0 ? `+${abs}` : abs;
}
