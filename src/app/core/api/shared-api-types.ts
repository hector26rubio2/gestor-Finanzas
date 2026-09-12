import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

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
}

/** API-facing money never uses JavaScript floating point. */
export interface ApiMoney {
  amount: string;
  currency: string;
}

export interface ApiMovementSummary {
  id: string;
  occurredOn: string;
  description: string;
  accountId: string;
  kind: string;
  flow: string;
  effect: string;
  money: ApiMoney;
  status: string;
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

export interface MovementRepository {
  list(query: MovementQuery): Observable<ApiPage<ApiMovementSummary>>;
}

export const MOVEMENT_REPOSITORY = new InjectionToken<MovementRepository>('MOVEMENT_REPOSITORY');

export function monthRange(period: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error('El periodo debe usar el formato AAAA-MM.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('El mes solicitado no es válido.');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(lastDay).padStart(2, '0')}` };
}
