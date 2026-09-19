const pad = (value: number): string => String(value).padStart(2, '0');

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function addMonthsToIso(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toIsoDate(target);
}

export function formatDateTime(iso: string | Date | null | undefined, locale: string): string {
  if (!iso) return '';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    date,
  );
}

export function formatDateTimeLong(iso: string | Date | null | undefined, locale: string): string {
  if (!iso) return '';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
