import type { ApiBootstrapBalances } from '@core/api/bootstrap.api';
import type { ApiDashboard } from '@core/api/reporting.api';
import type { Account } from '@core/state/view-model';
import { parseMoney } from '@core/utils/money';

export type MapaDeSaldos = ReadonlyMap<string, number>;

export interface Saldos {
  readonly confirmado: boolean;
  saldoDe(cuenta: Account): number;
  deudaDe(cuenta: Account): number;
  disponible(): number;
  deudaTotal(): number;
}

export interface EntradaDeSaldos {
  readonly cuentas: readonly Account[];
  readonly delServidor: MapaDeSaldos | null;
  readonly calculoLocal: (cuenta: Account) => number;
  readonly noConfirmado: boolean;
}

export function mapaDesdeBootstrap(balances: ApiBootstrapBalances | null): MapaDeSaldos | null {
  if (!balances) return null;
  const mapa = new Map<string, number>();
  for (const cuenta of balances.accounts ?? []) mapa.set(cuenta.account.id, parseMoney(cuenta.balance));
  for (const tarjeta of balances.cards ?? []) mapa.set(tarjeta.cardId, -parseMoney(tarjeta.debt));
  return mapa;
}

export function mapaDesdeTablero(tablero: Pick<ApiDashboard, 'accounts' | 'cards'>): MapaDeSaldos {
  const mapa = new Map<string, number>();
  for (const cuenta of tablero.accounts ?? []) mapa.set(cuenta.account.id, parseMoney(cuenta.balance));
  for (const tarjeta of tablero.cards ?? []) mapa.set(tarjeta.card.id, -parseMoney(tarjeta.debt));
  return mapa;
}

const esTarjeta = (cuenta: Account) => cuenta.type === 'credit';

export function crearSaldos(entrada: EntradaDeSaldos): Saldos {
  const saldoDe = (cuenta: Account) => entrada.delServidor?.get(cuenta.id) ?? entrada.calculoLocal(cuenta);
  const deudaDe = (cuenta: Account) => (esTarjeta(cuenta) ? Math.max(0, -saldoDe(cuenta)) : 0);
  return {
    confirmado: !entrada.noConfirmado,
    saldoDe,
    deudaDe,
    disponible: () => entrada.cuentas.filter((c) => !esTarjeta(c)).reduce((total, c) => total + saldoDe(c), 0),
    deudaTotal: () => entrada.cuentas.filter(esTarjeta).reduce((total, c) => total + deudaDe(c), 0),
  };
}
