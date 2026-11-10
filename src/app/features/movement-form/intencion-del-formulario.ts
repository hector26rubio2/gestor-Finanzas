import type {
  IntencionDeCompraParaTercero,
  IntencionDeGasto,
  IntencionDeIngreso,
  IntencionDeMovimiento,
} from '@core/state/operacion/intencion';
import type { Movement, Person } from '@core/state/view-model';
import type { MovementFormModel } from './movement-form';

export interface ContextoDelFormulario {
  readonly moneda: 'COP' | 'USD';
  personaPorNombre(nombre: string): Person | undefined;
  movimiento(id: string): Movement | undefined;
}

function datosDeCompra(modelo: MovementFormModel, contexto: ContextoDelFormulario) {
  return {
    fecha: modelo.date,
    descripcion: modelo.description,
    cuentaId: modelo.accountId,
    monto: modelo.amount,
    categoria: modelo.category,
    recurrente: modelo.recurring === 'true',
    cuotas: modelo.installmentTotal,
    tasaDeCuota: modelo.installmentRate ?? undefined,
    balde: modelo.cardBucket,
    enDolares: contexto.moneda === 'USD' ? { monto: modelo.originalAmount, tasa: modelo.exchangeRate } : undefined,
  };
}

function gastoOIngreso(
  modelo: MovementFormModel,
  contexto: ContextoDelFormulario,
): IntencionDeGasto | IntencionDeIngreso {
  const datos = datosDeCompra(modelo, contexto);
  if (modelo.kind !== 'income') return { tipo: 'gasto', ...datos };
  const recibido = modelo.operationType === 'received';
  const contraparte = recibido ? modelo.counterpartyId : contexto.personaPorNombre(modelo.person)?.id;
  return { tipo: 'ingreso', ...datos, contraparteId: contraparte || undefined, exigeContraparte: recibido };
}

function claseEfectiva(modelo: MovementFormModel): string {
  return modelo.operationType === 'transfer' || modelo.operationType === 'advance' ? modelo.operationType : modelo.kind;
}

function claseOriginal(original: Movement): string {
  return original.movementSubtype === 'transfer' || original.movementSubtype === 'advance'
    ? original.movementSubtype
    : original.kind;
}

function cambiaElRegistro(original: Movement, modelo: MovementFormModel, contexto: ContextoDelFormulario): boolean {
  return (
    original.date !== modelo.date ||
    original.accountId !== modelo.accountId ||
    claseOriginal(original) !== claseEfectiva(modelo) ||
    Math.abs(original.amount) !== modelo.amount ||
    (original.installmentTotal ?? 1) !== (Number(modelo.installmentTotal) || 1) ||
    (original.originalCurrency ?? 'COP') !== contexto.moneda ||
    (contexto.moneda === 'USD' && original.originalAmount !== modelo.originalAmount)
  );
}

function deEdicion(modelo: MovementFormModel, id: string, contexto: ContextoDelFormulario): IntencionDeMovimiento {
  const original = contexto.movimiento(id);
  if (!original || cambiaElRegistro(original, modelo, contexto))
    return { tipo: 'correccion', originalId: id, reemplazo: gastoOIngreso(modelo, contexto) };
  return { tipo: 'reclasificacion', movimientoId: id, categoria: modelo.category, descripcion: modelo.description };
}

export function intencionDelFormulario(
  modelo: MovementFormModel,
  contexto: ContextoDelFormulario,
): IntencionDeMovimiento {
  if (modelo.id) return deEdicion(modelo, modelo.id, contexto);
  const base = { fecha: modelo.date, descripcion: modelo.description, monto: modelo.amount };
  switch (modelo.operationType) {
    case 'transfer':
      return { tipo: 'transferencia', ...base, origenId: modelo.accountId, destinoId: modelo.targetId };
    case 'advance':
      return {
        tipo: 'avance',
        ...base,
        tarjetaId: modelo.accountId,
        destinoId: modelo.targetId,
        cuotas: modelo.installmentTotal,
        tasaDeCuota: modelo.installmentRate ?? undefined,
      };
    case 'loan':
    case 'credit':
      return {
        tipo: 'prestamo',
        ...base,
        sentido: modelo.kind === 'income' ? 'recibido' : 'otorgado',
        cuentaId: modelo.accountId,
        contraparteId: modelo.counterpartyId,
        producto: modelo.operationType === 'credit' ? modelo.loanProduct : undefined,
        tasaMensual: modelo.monthlyRate ?? undefined,
        plazoMeses: modelo.termMonths,
        modoDeTarjeta: modelo.cardMode === 'cashAdvance' ? 'cashAdvance' : 'purchase',
      };
    case 'borrowedCard':
      return {
        tipo: 'tarjetaPrestada',
        ...base,
        prestamistaId: modelo.counterpartyId,
        nombreDeTarjeta: modelo.borrowedCardName,
        plazoMeses: modelo.termMonths,
        tasaMensual: modelo.monthlyRate ?? undefined,
      };
    default:
      return normal(modelo, contexto);
  }
}

function normal(modelo: MovementFormModel, contexto: ContextoDelFormulario): IntencionDeMovimiento {
  const tercero = modelo.kind === 'income' ? undefined : contexto.personaPorNombre(modelo.person);
  if (!tercero) return gastoOIngreso(modelo, contexto);
  const paraTercero: IntencionDeCompraParaTercero = {
    tipo: 'compraParaTercero',
    ...datosDeCompra(modelo, contexto),
    terceroId: tercero.id,
  };
  return paraTercero;
}
