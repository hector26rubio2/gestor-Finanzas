export interface ApiPage<T> {
  items: readonly T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ApiMovementTotals {
  income: ApiMoney;
  expense: ApiMoney;
  net: ApiMoney;
}

export interface ApiMovementPage<T> {
  items: readonly T[];
  page: number;
  size: number;
  total: number | null;
  totalPages: number;
  hasNext: boolean;
  nextCursor?: string | null;
  totals?: ApiMovementTotals | null;
}

export interface MovementQuery {
  page: number;
  pageSize: number;
  after?: string;
  period?: string;
  accountId?: string;
  search?: string;
  filter?: Readonly<Record<string, unknown>>;
}

export interface ApiMoney {
  amount: string;
  currency: string;
}

export interface ApiLinkRef {
  id: string;
  name: string;
}

export interface ApiConvertedMoney {
  original: ApiMoney;
  base: ApiMoney;
  rate: string;
  rateAsOf: string;
}

export function monthRange(period: string): { start: string; end: string } {
  if (/^\d{4}$/.test(period)) return { start: `${period}-01-01`, end: `${period}-12-31` };
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error('El periodo debe usar el formato AAAA-MM.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('El mes solicitado no es válido.');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(lastDay).padStart(2, '0')}` };
}
