import type { Movement } from '@core/state';
import { esEconomico } from '@core/state/economia';

export interface FiltrosDeExplorador {
  readonly cuenta: string;
  readonly categoria: string;
  readonly flujo: 'all' | 'in' | 'out';
}

export const filtrarMovimientos = (
  movimientos: readonly Movement[],
  { cuenta, categoria, flujo }: FiltrosDeExplorador,
): Movement[] =>
  movimientos.filter(
    (m) =>
      esEconomico(m) &&
      (cuenta === 'all' || m.accountId === cuenta) &&
      (categoria === 'all' || m.category === categoria) &&
      (flujo === 'all' || (flujo === 'in' ? m.amount > 0 : m.amount < 0)),
  );
