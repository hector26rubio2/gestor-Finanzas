import type { AccountViewType } from '@core/api';
import { P } from '@core/session/permissions';

export type DestinoDeCuenta = 'origen' | 'destino';

export interface ContextoDeCuenta {
  destino: DestinoDeCuenta;
  kind: string;
  operation: string;
  permite: (permiso: string) => boolean;
  monedaDelMovimiento?: string;
}

export interface PropuestaDeCuenta {
  tipos: readonly AccountViewType[];
  tipoSugerido: AccountViewType;
  monedaSugerida: 'COP' | 'USD' | null;
}

const TIPOS_SIN_TARJETA: readonly AccountViewType[] = ['savings', 'checking', 'cash', 'wallet', 'other'];
const TODOS_LOS_TIPOS: readonly AccountViewType[] = [...TIPOS_SIN_TARJETA, 'credit'];

export function permisoParaTipoDeCuenta(tipo: AccountViewType): string {
  if (tipo === 'credit') return P.cuentas.tarjetas.crear;
  if (tipo === 'savings' || tipo === 'checking') return P.cuentas.ahorro.crear;
  if (tipo === 'cash' || tipo === 'wallet') return P.cuentas.efectivo.crear;
  return P.cuentas.crear;
}

function tiposAdmitidos(contexto: ContextoDeCuenta): readonly AccountViewType[] {
  if (contexto.destino === 'destino') return TIPOS_SIN_TARJETA;
  if (contexto.operation === 'advance') return ['credit'];
  const admiteTarjeta =
    contexto.kind === 'expense' &&
    (contexto.operation === 'normal' || contexto.operation === 'loan') &&
    contexto.permite(P.movimientos.creditos.crear);
  return admiteTarjeta ? TODOS_LOS_TIPOS : TIPOS_SIN_TARJETA;
}

function puedeCrearTipo(contexto: ContextoDeCuenta, tipo: AccountViewType): boolean {
  if (!contexto.permite(permisoParaTipoDeCuenta(tipo))) return false;
  return tipo === 'credit' || contexto.permite(P.cuentas.crear);
}

function monedaSugerida(contexto: ContextoDeCuenta): 'COP' | 'USD' | null {
  const moneda = contexto.monedaDelMovimiento;
  return moneda === 'USD' || moneda === 'COP' ? moneda : null;
}

export function propuestaDeCuenta(contexto: ContextoDeCuenta): PropuestaDeCuenta | null {
  const tipos = tiposAdmitidos(contexto).filter((tipo) => puedeCrearTipo(contexto, tipo));
  if (!tipos.length) return null;
  const tipoSugerido = contexto.operation === 'advance' ? 'credit' : tipos[0];
  return { tipos, tipoSugerido, monedaSugerida: monedaSugerida(contexto) };
}
