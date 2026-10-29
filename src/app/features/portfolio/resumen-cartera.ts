import type { Investment } from '@core/state';
import { returnRate, sumBy } from '@core/utils';

export interface ResumenCartera {
  readonly valor: number;
  readonly costo: number;
  readonly ganancia: number;
  readonly rendimiento: number | null;
  readonly otrasMonedas: readonly { moneda: string; valor: number }[];
}

export function resumenCartera(inversiones: readonly Investment[], monedaBase: string): ResumenCartera {
  const base = inversiones.filter((i) => i.currency === monedaBase);
  const porMoneda = new Map<string, Investment[]>();
  for (const inversion of inversiones) {
    if (inversion.currency === monedaBase) continue;
    porMoneda.set(inversion.currency, [...(porMoneda.get(inversion.currency) ?? []), inversion]);
  }
  const valor = sumBy(base, (i) => i.value, monedaBase);
  const costo = sumBy(base, (i) => i.cost, monedaBase);
  return {
    valor,
    costo,
    ganancia: sumBy(base, (i) => i.value - i.cost, monedaBase),
    rendimiento: returnRate(valor, costo),
    otrasMonedas: [...porMoneda.entries()].map(([moneda, lista]) => ({
      moneda,
      valor: sumBy(lista, (i) => i.value, moneda),
    })),
  };
}
