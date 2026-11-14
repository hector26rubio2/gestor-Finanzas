import type { LoanCardModeKey } from '@core/api/obligations.api';
import type { Movement } from '../view-model';

export interface MontoEnDolares {
  readonly monto: number;
  readonly tasa: number;
}

interface DatosBase {
  readonly fecha: string;
  readonly descripcion: string;
}

interface DatosDeCompra extends DatosBase {
  readonly cuentaId: string;
  readonly monto: number;
  readonly categoria: string;
  readonly recurrente: boolean;
  readonly cuotas?: number;
  readonly tasaDeCuota?: number;
  readonly balde?: number;
  readonly enDolares?: MontoEnDolares;
  readonly hora?: string;
}

export interface IntencionDeGasto extends DatosDeCompra {
  readonly tipo: 'gasto';
}

export interface IntencionDeIngreso extends DatosDeCompra {
  readonly tipo: 'ingreso';
  readonly contraparteId?: string;
  readonly exigeContraparte?: boolean;
}

export interface IntencionDeCompraParaTercero extends DatosDeCompra {
  readonly tipo: 'compraParaTercero';
  readonly terceroId: string;
}

export interface IntencionDeTransferencia extends DatosBase {
  readonly tipo: 'transferencia';
  readonly origenId: string;
  readonly destinoId: string;
  readonly monto: number;
}

export interface IntencionDeAvance extends DatosBase {
  readonly tipo: 'avance';
  readonly tarjetaId: string;
  readonly destinoId: string;
  readonly monto: number;
  readonly cuotas?: number;
  readonly tasaDeCuota?: number;
}

export interface IntencionDePagoDeTarjeta extends DatosBase {
  readonly tipo: 'pagoDeTarjeta';
  readonly origenId: string;
  readonly tarjetaId: string;
  readonly monto: number;
}

export type ProductoDePrestamo = NonNullable<Movement['loanProduct']>;

export interface IntencionDePrestamo extends DatosBase {
  readonly tipo: 'prestamo';
  readonly sentido: 'otorgado' | 'recibido';
  readonly cuentaId: string;
  readonly contraparteId: string;
  readonly monto: number;
  readonly producto?: ProductoDePrestamo;
  readonly tasaMensual?: number;
  readonly plazoMeses?: number;
  readonly modoDeTarjeta?: LoanCardModeKey;
}

export interface IntencionDeTarjetaPrestada extends DatosBase {
  readonly tipo: 'tarjetaPrestada';
  readonly prestamistaId: string;
  readonly monto: number;
  readonly nombreDeTarjeta?: string;
  readonly plazoMeses?: number;
  readonly tasaMensual?: number;
}

export interface IntencionDeCorreccion {
  readonly tipo: 'correccion';
  readonly originalId: string;
  readonly reemplazo: IntencionDeGasto | IntencionDeIngreso;
}

export interface IntencionDeReclasificacion {
  readonly tipo: 'reclasificacion';
  readonly movimientoId: string;
  readonly categoria: string;
  readonly descripcion: string;
}

export type IntencionDeMovimiento =
  | IntencionDeGasto
  | IntencionDeIngreso
  | IntencionDeTransferencia
  | IntencionDeAvance
  | IntencionDePagoDeTarjeta
  | IntencionDePrestamo
  | IntencionDeCompraParaTercero
  | IntencionDeTarjetaPrestada
  | IntencionDeCorreccion
  | IntencionDeReclasificacion;

export type TipoDeIntencion = IntencionDeMovimiento['tipo'];
