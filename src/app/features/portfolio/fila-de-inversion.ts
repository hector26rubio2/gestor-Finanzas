import type { Investment } from '@core/state';
import { formatReturnRate } from '@core/utils';
import { SIN_DATO } from '@shared/utils';

export const filaDeInversion = (i: Investment, money: (valor: number, moneda: string) => string) => ({
  id: i.id,
  name: i.name,
  type: i.type,
  institution: i.institution ?? SIN_DATO,
  risk: i.risk ? (i.liquidity ? `${i.risk} · ${i.liquidity}` : i.risk) : SIN_DATO,
  cost: money(i.cost, i.currency),
  value: money(i.value, i.currency),
  return: formatReturnRate(i.value, i.cost),
  sinValoracion: i.sinValoracion,
});
