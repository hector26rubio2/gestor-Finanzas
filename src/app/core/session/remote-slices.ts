import { ObservedValueOf } from 'rxjs';
import { ApiSession, FinanceApiClient } from '../api/api-client';
import { P } from './permissions';

export type Rebanada =
  | 'movementKinds'
  | 'accounts'
  | 'cards'
  | 'categories'
  | 'people'
  | 'debts'
  | 'investments'
  | 'movements'
  | 'preferences';
export const SLICES: readonly Rebanada[] = [
  'movementKinds',
  'accounts',
  'cards',
  'categories',
  'people',
  'debts',
  'investments',
  'movements',
  'preferences',
];
/** Permiso que autoriza pedir cada rebanada: el mismo código que exige el endpoint. */
export const PERMISO_DE: Record<Rebanada, string> = {
  movementKinds: P.movimientos.clases.listar,
  accounts: P.cuentas.ver,
  cards: P.cuentas.tarjetas.listar,
  categories: P.cuentas.categorias.listar,
  people: P.personas.ver,
  debts: P.personas.deudas.listar,
  investments: P.patrimonio.ver,
  movements: P.movimientos.ver,
  preferences: P.preferencias.ver,
};

export interface RawData {
  movementKinds: ObservedValueOf<ReturnType<FinanceApiClient['movementKinds']>>;
  accounts: ObservedValueOf<ReturnType<FinanceApiClient['accounts']>>;
  cards: ObservedValueOf<ReturnType<FinanceApiClient['cards']>>;
  categories: ObservedValueOf<ReturnType<FinanceApiClient['categories']>>;
  people: ObservedValueOf<ReturnType<FinanceApiClient['people']>>;
  debts: ObservedValueOf<ReturnType<FinanceApiClient['debts']>>;
  investments: ObservedValueOf<ReturnType<FinanceApiClient['investments']>>;
  movements: ObservedValueOf<ReturnType<FinanceApiClient['movements']>>;
  preferences: ObservedValueOf<ReturnType<FinanceApiClient['preferences']>> | null;
  notifications: ObservedValueOf<ReturnType<FinanceApiClient['notifications']>>;
}

export function emptyRaw(): RawData {
  return {
    movementKinds: [],
    accounts: [],
    cards: [],
    categories: [],
    people: [],
    debts: [],
    investments: [],
    movements: { items: [], page: 1, size: 25, total: 0, totalPages: 0, hasNext: false },
    preferences: null,
    notifications: [],
  };
}

/** Persona y organización: si cambia una de las dos, los datos cargados ya no valen. */
export function identidadDe(session: ApiSession): string {
  return `${session.user.id}|${session.organization.id}`;
}

export function mismaLista(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((valor, i) => valor === b[i]);
}
