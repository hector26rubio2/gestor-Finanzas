/*
 * Fichero de tipos compartidos por los clientes de recurso. Aquí vivían
 * `ApiMovementSummary` y `MovementRepository`/`MOVEMENT_REPOSITORY`: estaban declarados y
 * exportados, pero nadie los usaba, y su contrato no coincidía con el real
 * (`occurredOn`/`money`/`kind: string` frente a `date`/`amount`/enum numérico). Código
 * muerto que engaña a quien lo lea, así que se retiró: el resumen de movimiento real es
 * `ApiMovement`, en `ledger.api.ts`, y las consultas pasan por `MovementQuery` de aquí.
 */

export interface ApiPage<T> {
  items: readonly T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface MovementQuery {
  page: number;
  pageSize: number;
  period?: string;
  accountId?: string;
  search?: string;
  filter?: Readonly<Record<string, unknown>>;
}

/** API-facing money never uses JavaScript floating point. */
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
