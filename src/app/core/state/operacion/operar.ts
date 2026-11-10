import type {
  CreateCardPaymentBody,
  CreateCashAdvanceBody,
  CreateMovementBody,
  CreateTransferBody,
} from '@core/api/ledger.api';
import { LOAN_CARD_MODE, LOAN_PRODUCT, OBLIGATION_DIRECTION, type CreateLoanBody } from '@core/api/obligations.api';
import { SHARE_BASIS } from '@core/api/purchases.api';
import { P } from '@core/session/permissions';
import { CashFlow, EconomicEffect, MovementKind } from '@core/utils/movement-kinds';
import { anualDesdeMensual } from '@core/utils/tasas';
import type { Account, Movement, Person } from '../view-model';
import type {
  IntencionDeCompraParaTercero,
  IntencionDeGasto,
  IntencionDeIngreso,
  IntencionDeMovimiento,
  IntencionDePrestamo,
} from './intencion';

export interface EntornoDeOperacion {
  cuenta(id: string): Account | undefined;
  persona(id: string): Person | undefined;
  categoria(nombre: string): { readonly id: string } | undefined;
  movimiento(id: string): Movement | undefined;
  permite(permiso: string): boolean;
  readonly monedaBase: string;
  nuevaClave(): string;
}

export type CodigoDeError =
  | 'sin_permiso'
  | 'monto_invalido'
  | 'cuenta_invalida'
  | 'destino_invalido'
  | 'contraparte_requerida'
  | 'tasa_invalida'
  | 'tasa_de_cambio_invalida'
  | 'no_corregible'
  | 'movimiento_no_encontrado'
  | 'compra_con_tarjeta_prohibida'
  | 'transferencia_con_tarjeta'
  | 'avance_con_cuentas_invalidas'
  | 'ingreso_en_tarjeta';

export const CLAVE_DE_ERROR: Readonly<Record<CodigoDeError, string>> = {
  sin_permiso: 'form.error.forbidden',
  monto_invalido: 'form.movement.error.amountPositive',
  cuenta_invalida: 'form.movement.error.accountInvalid',
  destino_invalido: 'form.movement.error.targetDifferent',
  contraparte_requerida: 'form.movement.error.counterpartyRequired',
  tasa_invalida: 'form.movement.error.rateInvalid',
  tasa_de_cambio_invalida: 'form.account.error.exchangeRate',
  no_corregible: 'form.movement.error.operationNotCorrectable',
  movimiento_no_encontrado: 'form.movement.error.originalNotFound',
  compra_con_tarjeta_prohibida: 'form.movement.error.creditPurchaseForbidden',
  transferencia_con_tarjeta: 'form.movement.error.transferCreditForbidden',
  avance_con_cuentas_invalidas: 'form.movement.error.advanceAccountInvalid',
  ingreso_en_tarjeta: 'form.movement.error.incomeCreditForbidden',
};

export interface ErrorDeOperacion {
  readonly codigo: CodigoDeError;
}

export interface OpcionesDeMapeo {
  readonly descripcion?: string;
  readonly categoria?: string;
  readonly persona?: string;
  readonly propiedad?: 'own' | 'loaned';
  readonly recurrente?: boolean;
  readonly producto?: NonNullable<Movement['loanProduct']>;
  readonly plazoMeses?: number;
  readonly aprAnual?: number;
}

export interface RepartoCompleto {
  readonly terceroId: string;
  readonly descripcion: string | null;
}

export type SolicitudDeOperacion =
  | {
      readonly via: 'movimiento';
      readonly cuerpo: CreateMovementBody;
      readonly reparto?: RepartoCompleto;
      readonly presentacion: OpcionesDeMapeo;
    }
  | {
      readonly via: 'correccion';
      readonly originalId: string;
      readonly cuerpo: CreateMovementBody;
      readonly presentacion: OpcionesDeMapeo;
    }
  | {
      readonly via: 'reclasificacion';
      readonly movimientoId: string;
      readonly cuerpo: { readonly category: string | null; readonly description: string | null };
      readonly presentacion: OpcionesDeMapeo;
    }
  | { readonly via: 'transferencia'; readonly cuerpo: CreateTransferBody }
  | { readonly via: 'avance'; readonly cuerpo: CreateCashAdvanceBody }
  | { readonly via: 'pagoDeTarjeta'; readonly cuerpo: CreateCardPaymentBody }
  | { readonly via: 'prestamo'; readonly cuerpo: CreateLoanBody; readonly presentacion: OpcionesDeMapeo }
  | { readonly via: 'tarjetaPrestada'; readonly cuerpo: CreateLoanBody };

export type ResultadoDeOperacion =
  | { readonly ok: true; readonly solicitud: SolicitudDeOperacion }
  | { readonly ok: false; readonly error: ErrorDeOperacion };

const fallo = (codigo: CodigoDeError): ResultadoDeOperacion => ({ ok: false, error: { codigo } });
const exito = (solicitud: SolicitudDeOperacion): ResultadoDeOperacion => ({ ok: true, solicitud });

const montoValido = (monto: number): boolean => Number.isFinite(monto) && monto > 0;
const esTarjeta = (cuenta: Account | undefined): boolean => cuenta?.type === 'credit';
const cuotasDe = (cuotas: number | undefined): number | undefined => (Number(cuotas) > 1 ? Number(cuotas) : undefined);
const tasaValida = (tasa: number | undefined): boolean => {
  const valor = Number(tasa ?? 0);
  return Number.isFinite(valor) && valor >= 0 && valor <= 100;
};

export function repartoCompleto(movimientoId: string, reparto: RepartoCompleto) {
  return {
    purchaseMovement: movimientoId,
    shares: [{ counterparty: reparto.terceroId, basis: SHARE_BASIS.full }],
    description: reparto.descripcion,
  };
}

function cuerpoDeCompra(
  intencion: IntencionDeGasto | IntencionDeIngreso | IntencionDeCompraParaTercero,
  cuenta: Account,
  env: EntornoDeOperacion,
): CreateMovementBody {
  const esIngreso = intencion.tipo === 'ingreso';
  const conTarjeta = esTarjeta(cuenta);
  const categoria = env.categoria(intencion.categoria);
  const contraparte =
    intencion.tipo === 'compraParaTercero'
      ? intencion.terceroId
      : intencion.tipo === 'ingreso'
        ? intencion.contraparteId
        : undefined;
  const cuotas = cuotasDe(intencion.cuotas);
  const aprPropia =
    cuotas === undefined || intencion.tasaDeCuota === undefined ? undefined : anualDesdeMensual(intencion.tasaDeCuota);
  const dolares = intencion.enDolares;
  return {
    date: intencion.fecha,
    kind: esIngreso ? MovementKind.income : conTarjeta ? MovementKind.cardPurchase : MovementKind.expense,
    effect: esIngreso ? EconomicEffect.income : EconomicEffect.expense,
    flow: esIngreso ? CashFlow.inflow : CashFlow.outflow,
    amount: dolares
      ? { amount: String(dolares.monto), currency: 'USD' }
      : { amount: String(intencion.monto), currency: cuenta.currency },
    links: {
      ...(conTarjeta ? { card: cuenta.id } : { account: cuenta.id }),
      ...(categoria ? { category: categoria.id } : {}),
      ...(contraparte ? { counterparty: contraparte } : {}),
    },
    rate: dolares ? String(dolares.tasa) : undefined,
    rateAsOf: dolares ? intencion.fecha : undefined,
    description: intencion.descripcion,
    idempotencyKey: env.nuevaClave(),
    purchaseApr: conTarjeta ? aprPropia : undefined,
    installments: conTarjeta ? cuotas : undefined,
    cardBucket: conTarjeta && intencion.balde ? intencion.balde : undefined,
  };
}

function validarCompra(
  intencion: IntencionDeGasto | IntencionDeIngreso | IntencionDeCompraParaTercero,
  env: EntornoDeOperacion,
  permisoBase: string,
): { readonly cuenta: Account } | ErrorDeOperacion {
  if (!env.permite(permisoBase)) return { codigo: 'sin_permiso' };
  if (!montoValido(intencion.monto)) return { codigo: 'monto_invalido' };
  if (intencion.enDolares && !montoValido(intencion.enDolares.monto)) return { codigo: 'monto_invalido' };
  if (intencion.enDolares && !(intencion.enDolares.tasa > 0)) return { codigo: 'tasa_de_cambio_invalida' };
  const cuenta = env.cuenta(intencion.cuentaId);
  if (!cuenta) return { codigo: 'cuenta_invalida' };
  if (intencion.tipo === 'ingreso') {
    if (esTarjeta(cuenta)) return { codigo: 'ingreso_en_tarjeta' };
    if (intencion.exigeContraparte && !(intencion.contraparteId && env.persona(intencion.contraparteId)))
      return { codigo: 'contraparte_requerida' };
  } else if (esTarjeta(cuenta) && !env.permite(P.movimientos.creditos.crear))
    return { codigo: 'compra_con_tarjeta_prohibida' };
  return { cuenta };
}

const esError = (valor: object): valor is ErrorDeOperacion => 'codigo' in valor;

function operarCompra(
  intencion: IntencionDeGasto | IntencionDeIngreso,
  env: EntornoDeOperacion,
  permisoBase: string,
): ResultadoDeOperacion {
  const validada = validarCompra(intencion, env, permisoBase);
  if (esError(validada)) return fallo(validada.codigo);
  return exito({
    via: 'movimiento',
    cuerpo: cuerpoDeCompra(intencion, validada.cuenta, env),
    presentacion: {
      descripcion: intencion.descripcion,
      categoria: intencion.categoria,
      recurrente: intencion.recurrente,
    },
  });
}

function solicitudDePrestamo(
  datos: {
    fecha: string;
    descripcion: string;
    monto: number;
    sentido: IntencionDePrestamo['sentido'];
    contraparte: Person;
    cuenta: Account;
    producto?: IntencionDePrestamo['producto'];
    tasaMensual?: number;
    plazoMeses?: number;
    modoDeTarjeta?: IntencionDePrestamo['modoDeTarjeta'];
  },
  env: EntornoDeOperacion,
): SolicitudDeOperacion {
  const recibido = datos.sentido === 'recibido';
  const plazo = Number(datos.plazoMeses) > 0 ? Math.round(Number(datos.plazoMeses)) : undefined;
  const tasa = datos.tasaMensual === undefined || datos.tasaMensual === null ? undefined : Number(datos.tasaMensual);
  return {
    via: 'prestamo',
    cuerpo: {
      date: datos.fecha,
      direction: recibido ? OBLIGATION_DIRECTION.payable : OBLIGATION_DIRECTION.receivable,
      counterparty: datos.contraparte.id,
      amount: { amount: String(datos.monto), currency: datos.cuenta.currency },
      ...(esTarjeta(datos.cuenta)
        ? { card: datos.cuenta.id, cardMode: LOAN_CARD_MODE[datos.modoDeTarjeta ?? 'purchase'] }
        : { account: datos.cuenta.id }),
      product: datos.producto ? LOAN_PRODUCT[datos.producto] : LOAN_PRODUCT.informal,
      monthlyRate: tasa === undefined ? undefined : tasa / 100,
      termMonths: plazo,
      description: datos.descripcion || undefined,
      idempotencyKey: env.nuevaClave(),
    },
    presentacion: {
      descripcion: datos.descripcion || datos.contraparte.name,
      categoria: '',
      persona: datos.contraparte.name,
      propiedad: 'loaned',
      producto: datos.producto,
      plazoMeses: plazo,
      aprAnual: tasa === undefined ? undefined : anualDesdeMensual(tasa),
    },
  };
}

function operarPrestamo(intencion: IntencionDePrestamo, env: EntornoDeOperacion): ResultadoDeOperacion {
  const permiso = intencion.producto ? P.movimientos.creditos.crear : P.movimientos.prestamos.crear;
  if (!env.permite(permiso)) return fallo('sin_permiso');
  if (!montoValido(intencion.monto)) return fallo('monto_invalido');
  const cuenta = env.cuenta(intencion.cuentaId);
  if (!cuenta) return fallo('cuenta_invalida');
  if (intencion.sentido === 'recibido' && esTarjeta(cuenta)) return fallo('ingreso_en_tarjeta');
  const contraparte = env.persona(intencion.contraparteId);
  if (!contraparte) return fallo('contraparte_requerida');
  if (!tasaValida(intencion.tasaMensual)) return fallo('tasa_invalida');
  return exito(solicitudDePrestamo({ ...intencion, contraparte, cuenta }, env));
}

function operarCompraParaTercero(
  intencion: IntencionDeCompraParaTercero,
  env: EntornoDeOperacion,
): ResultadoDeOperacion {
  const validada = validarCompra(intencion, env, P.movimientos.crear);
  if (esError(validada)) return fallo(validada.codigo);
  const tercero = env.persona(intencion.terceroId);
  if (!tercero) return fallo('contraparte_requerida');
  if (!esTarjeta(validada.cuenta))
    return exito(
      solicitudDePrestamo(
        {
          fecha: intencion.fecha,
          descripcion: intencion.descripcion,
          monto: intencion.monto,
          sentido: 'otorgado',
          contraparte: tercero,
          cuenta: validada.cuenta,
        },
        env,
      ),
    );
  return exito({
    via: 'movimiento',
    cuerpo: cuerpoDeCompra(intencion, validada.cuenta, env),
    reparto: { terceroId: tercero.id, descripcion: intencion.descripcion || null },
    presentacion: {
      descripcion: intencion.descripcion,
      categoria: intencion.categoria,
      recurrente: intencion.recurrente,
      persona: tercero.name,
      propiedad: 'loaned',
    },
  });
}

function operarCorreccion(
  intencion: Extract<IntencionDeMovimiento, { tipo: 'correccion' }>,
  env: EntornoDeOperacion,
): ResultadoDeOperacion {
  if (!env.permite(P.movimientos.editar)) return fallo('sin_permiso');
  const original = env.movimiento(intencion.originalId);
  if (!original) return fallo('movimiento_no_encontrado');
  if (original.movementSubtype || original.kind === 'payment' || original.loanRole) return fallo('no_corregible');
  const validada = validarCompra(intencion.reemplazo, env, P.movimientos.editar);
  if (esError(validada)) return fallo(validada.codigo);
  return exito({
    via: 'correccion',
    originalId: original.id,
    cuerpo: cuerpoDeCompra(intencion.reemplazo, validada.cuenta, env),
    presentacion: {
      descripcion: intencion.reemplazo.descripcion,
      categoria: intencion.reemplazo.categoria,
      recurrente: intencion.reemplazo.recurrente,
    },
  });
}

function operarTransferencia(
  intencion: Extract<IntencionDeMovimiento, { tipo: 'transferencia' }>,
  env: EntornoDeOperacion,
): ResultadoDeOperacion {
  if (!env.permite(P.movimientos.transferencias.crear)) return fallo('sin_permiso');
  if (!montoValido(intencion.monto)) return fallo('monto_invalido');
  const origen = env.cuenta(intencion.origenId);
  if (!origen) return fallo('cuenta_invalida');
  const destino = env.cuenta(intencion.destinoId);
  if (!destino || destino.id === origen.id) return fallo('destino_invalido');
  if (esTarjeta(origen) || esTarjeta(destino)) return fallo('transferencia_con_tarjeta');
  return exito({
    via: 'transferencia',
    cuerpo: {
      date: intencion.fecha,
      amount: { amount: String(intencion.monto), currency: origen.currency },
      sourceAccount: origen.id,
      destinationAccount: destino.id,
      description: intencion.descripcion,
      idempotencyKey: env.nuevaClave(),
    },
  });
}

function operarAvance(
  intencion: Extract<IntencionDeMovimiento, { tipo: 'avance' }>,
  env: EntornoDeOperacion,
): ResultadoDeOperacion {
  if (!env.permite(P.movimientos.avances.crear)) return fallo('sin_permiso');
  if (!montoValido(intencion.monto)) return fallo('monto_invalido');
  const tarjeta = env.cuenta(intencion.tarjetaId);
  if (!tarjeta) return fallo('cuenta_invalida');
  const destino = env.cuenta(intencion.destinoId);
  if (!esTarjeta(tarjeta) || esTarjeta(destino)) return fallo('avance_con_cuentas_invalidas');
  if (!destino || destino.id === tarjeta.id) return fallo('destino_invalido');
  const cuotas = cuotasDe(intencion.cuotas);
  return exito({
    via: 'avance',
    cuerpo: {
      date: intencion.fecha,
      amount: { amount: String(intencion.monto), currency: tarjeta.currency },
      card: tarjeta.id,
      account: destino.id,
      description: intencion.descripcion,
      idempotencyKey: env.nuevaClave(),
      installments: cuotas,
      apr:
        cuotas === undefined || intencion.tasaDeCuota === undefined
          ? undefined
          : anualDesdeMensual(intencion.tasaDeCuota),
    },
  });
}

function operarPagoDeTarjeta(
  intencion: Extract<IntencionDeMovimiento, { tipo: 'pagoDeTarjeta' }>,
  env: EntornoDeOperacion,
): ResultadoDeOperacion {
  if (!env.permite(P.movimientos.pagos.crear)) return fallo('sin_permiso');
  if (!montoValido(intencion.monto)) return fallo('monto_invalido');
  const origen = env.cuenta(intencion.origenId);
  if (!origen) return fallo('cuenta_invalida');
  const tarjeta = env.cuenta(intencion.tarjetaId);
  if (!tarjeta || tarjeta.id === origen.id) return fallo('destino_invalido');
  return exito({
    via: 'pagoDeTarjeta',
    cuerpo: {
      date: intencion.fecha,
      amount: { amount: String(intencion.monto), currency: origen.currency },
      account: origen.id,
      card: tarjeta.id,
      description: intencion.descripcion,
      idempotencyKey: env.nuevaClave(),
    },
  });
}

function operarTarjetaPrestada(
  intencion: Extract<IntencionDeMovimiento, { tipo: 'tarjetaPrestada' }>,
  env: EntornoDeOperacion,
): ResultadoDeOperacion {
  if (!env.permite(P.movimientos.prestamos.crear)) return fallo('sin_permiso');
  if (!montoValido(intencion.monto)) return fallo('monto_invalido');
  const prestamista = env.persona(intencion.prestamistaId);
  if (!prestamista) return fallo('contraparte_requerida');
  return exito({
    via: 'tarjetaPrestada',
    cuerpo: {
      date: intencion.fecha,
      direction: OBLIGATION_DIRECTION.payable,
      counterparty: prestamista.id,
      amount: { amount: String(intencion.monto), currency: env.monedaBase },
      product: LOAN_PRODUCT.informal,
      description: intencion.descripcion || undefined,
      idempotencyKey: env.nuevaClave(),
      borrowedCard: true,
      borrowedCardName: intencion.nombreDeTarjeta?.trim() || undefined,
      termMonths: Number(intencion.plazoMeses) > 0 ? Math.round(Number(intencion.plazoMeses)) : undefined,
      monthlyRate:
        intencion.tasaMensual === undefined || intencion.tasaMensual === null
          ? undefined
          : Number(intencion.tasaMensual) / 100,
    },
  });
}

function operarReclasificacion(
  intencion: Extract<IntencionDeMovimiento, { tipo: 'reclasificacion' }>,
  env: EntornoDeOperacion,
): ResultadoDeOperacion {
  if (!env.permite(P.movimientos.editar)) return fallo('sin_permiso');
  return exito({
    via: 'reclasificacion',
    movimientoId: intencion.movimientoId,
    cuerpo: {
      category: env.categoria(intencion.categoria)?.id ?? null,
      description: intencion.descripcion || null,
    },
    presentacion: { descripcion: intencion.descripcion, categoria: intencion.categoria },
  });
}

export function operar(intencion: IntencionDeMovimiento, env: EntornoDeOperacion): ResultadoDeOperacion {
  switch (intencion.tipo) {
    case 'gasto':
    case 'ingreso':
      return operarCompra(intencion, env, P.movimientos.crear);
    case 'compraParaTercero':
      return operarCompraParaTercero(intencion, env);
    case 'transferencia':
      return operarTransferencia(intencion, env);
    case 'avance':
      return operarAvance(intencion, env);
    case 'pagoDeTarjeta':
      return operarPagoDeTarjeta(intencion, env);
    case 'prestamo':
      return operarPrestamo(intencion, env);
    case 'tarjetaPrestada':
      return operarTarjetaPrestada(intencion, env);
    case 'correccion':
      return operarCorreccion(intencion, env);
    case 'reclasificacion':
      return operarReclasificacion(intencion, env);
  }
}
