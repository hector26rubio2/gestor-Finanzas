import type { ApiObligation } from '@core/api';
import type { Account, Movement, Person } from '@core/state';
import { CARD_BUCKET, PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS, completarPrioridad } from '@core/api';
import { mensualDesdeAnual } from '@core/utils/tasas';
import { sumBy } from '@core/utils';
import { type Deuda, cuotaFija } from './amortizacion';
import { type CompraPendiente, comprasPendientes, ordenDeAbono, saldosPorConcepto } from '@shared/tarjetas/extracto';

export const TASA_MENSUAL_SUPUESTA_TARJETA = 2.5;
export const TASA_MENSUAL_SUPUESTA_CREDITO = 1.5;
export const CUOTAS_SUPUESTAS = 12;

export interface DeudaActual extends Deuda {
  readonly tasaConocida: boolean;
}

export interface TarjetasPorConcepto {
  readonly movimientos: readonly Movement[];
  readonly etiqueta: (concepto: number) => string;
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

const DEBO = 2;
const ABIERTA = 1;
const PERIODO_MENSUAL = 2;
const SIN_INTERES = 0;
const SIN_INTERES_EN: readonly number[] = [CARD_BUCKET.zeroRatePurchases, CARD_BUCKET.singleInstallmentPurchases];

const diferenciaDeMeses = (desde: string, hasta: string): number => {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

export function saldoTrasCuotas(capital: number, tasaMensual: number, cuotas: number, pagadas: number): number {
  if (pagadas <= 0) return capital;
  if (pagadas >= cuotas) return 0;
  const i = tasaMensual / 100;
  if (i === 0) return redondear(capital - (capital / cuotas) * pagadas);
  const cuota = cuotaFija(capital, tasaMensual, cuotas);
  const factor = (1 + i) ** pagadas;
  return redondear(Math.max(0, capital * factor - (cuota * (factor - 1)) / i));
}

const tasaMensualDeTarjeta = (tarjeta: Account): number =>
  tarjeta.annualRate ? mensualDesdeAnual(tarjeta.annualRate) : TASA_MENSUAL_SUPUESTA_TARJETA;

const cuotasRestantesDeTarjeta = (tarjeta: Account, movimientos: readonly Movement[]): number => {
  const restantes = movimientos
    .filter((m) => m.accountId === tarjeta.id && m.installmentTotal && m.installmentTotal > 1)
    .map((m) => (m.installmentTotal ?? 0) - (m.installmentCurrent ?? 1) + 1);
  return restantes.length ? Math.max(1, ...restantes) : CUOTAS_SUPUESTAS;
};

// Puerto de deuda del módulo `proyecciones` — fuentes de datos intercambiables que
// producen `DeudaActual` (adaptadores por fuente abajo).
//
// Estrategia de exportación en dos capítulos, intencional:
//  1. `escenarios.ts` reexporta los símbolos legacy (constantes TASA_*/CUOTAS_SUPUESTAS,
//     `saldoTrasCuotas`, `DeudaActual`, `TarjetasPorConcepto`) para no romper consumidores
//     que importan de `./escenarios`.
//  2. `index.ts` reexporta el puerto desde este archivo con nombres explícitos (`export *`
//     en el barrel reexporta esos nombres por dos rutas y TS2308 lo rechaza). Paso manual:
//     al agregar un símbolo NUEVO aquí, añádelo a la lista explícita de `index.ts`.

export interface PuertaDeObligaciones {
  readonly obligaciones: readonly ApiObligation[];
  readonly hoy: string;
}

export function DeudaDeObligaciones(fuente: PuertaDeObligaciones): DeudaActual[] {
  const { obligaciones, hoy } = fuente;
  return obligaciones
    .filter((o) => o.direction === DEBO && o.status === ABIERTA && Number(o.totalOutstanding.amount) > 0)
    .map<DeudaActual>((o) => {
      const vigente = o.interestPolicies.at(-1)?.policy;
      const tasa = vigente && vigente.kind !== SIN_INTERES ? Number(vigente.rate.rate) * 100 : 0;
      const tasaMensual = vigente?.period === PERIODO_MENSUAL ? redondear(tasa * 100) / 100 : mensualDesdeAnual(tasa);
      const capital = Number(o.totalOutstanding.amount);
      const plazo = o.dueOn ? Math.max(1, diferenciaDeMeses(o.openedOn, o.dueOn)) : null;
      const pagadas = plazo ? Math.min(plazo, Math.max(0, diferenciaDeMeses(o.openedOn, hoy))) : 0;
      return {
        id: `obligacion:${o.id}`,
        nombre: o.description?.trim() || o.counterparty.name,
        tipo: 'credito',
        saldo: capital,
        tasaMensual,
        tasaConocida: Boolean(vigente),
        cuotas: plazo ? Math.max(1, plazo - pagadas) : CUOTAS_SUPUESTAS,
      };
    })
    .filter((d) => d.saldo > 0);
}

export interface PuertaDeTarjeta {
  readonly tarjeta: Account;
  readonly saldoTotal: number;
  readonly movimientos: readonly Movement[];
  readonly etiqueta: (concepto: number) => string;
}

export function DeudaDeTarjetas(fuente: PuertaDeTarjeta): DeudaActual[] {
  const { tarjeta, saldoTotal, movimientos, etiqueta } = fuente;
  const tasaTarjeta = tasaMensualDeTarjeta(tarjeta);
  const prioridadConfigurada =
    tarjeta.currency && tarjeta.currency !== 'COP'
      ? completarPrioridad(tarjeta.foreignPaymentPriority, PRIORIDAD_EN_DOLARES)
      : completarPrioridad(tarjeta.paymentPriority, PRIORIDAD_EN_PESOS);
  const prioridad = ordenDeAbono(prioridadConfigurada, tarjeta.applyPaymentPriority !== false);
  const compras = comprasPendientes(
    movimientos.filter((m) => m.accountId === tarjeta.id),
    prioridad,
  );
  const saldos = saldosPorConcepto(compras, prioridad);
  const pendiente = sumBy(saldos, (s) => s.saldo);
  const escala = pendiente > saldoTotal && pendiente > 0 ? saldoTotal / pendiente : 1;
  const tasaDe = (concepto: number, tasaAnual?: number) =>
    SIN_INTERES_EN.includes(concepto) ? 0 : tasaAnual !== undefined ? mensualDesdeAnual(tasaAnual) : tasaTarjeta;
  const deudas = saldos.flatMap<DeudaActual>((s) => {
    const porTasa = new Map<number, CompraPendiente[]>();
    for (const compra of s.compras) {
      const tasa = tasaDe(s.concepto, compra.tasaAnual);
      porTasa.set(tasa, [...(porTasa.get(tasa) ?? []), compra]);
    }
    const variasTasas = porTasa.size > 1;
    return [...porTasa.entries()]
      .sort(([a], [b]) => b - a)
      .map(([tasa, compras]) => ({
        id: `tarjeta:${tarjeta.id}:${s.concepto}:${tasa}`,
        nombre: `${tarjeta.name} · ${etiqueta(s.concepto)}${variasTasas ? ` · ${tasa} %` : ''}`,
        tipo: 'tarjeta' as const,
        saldo: redondear(sumBy(compras, (c) => c.pendiente) * escala),
        tasaMensual: tasa,
        tasaConocida: Boolean(tarjeta.annualRate) || compras.every((c) => c.tasaAnual !== undefined),
        cuotas: Math.max(1, ...compras.map((c) => c.cuotas - c.cuotaActual + 1)),
        grupo: `tarjeta:${tarjeta.id}`,
        prioridad: prioridad.indexOf(s.concepto),
      }));
  });
  const resto = redondear(saldoTotal - sumBy(deudas, (d) => d.saldo));
  if (resto > 1)
    deudas.push({
      id: `tarjeta:${tarjeta.id}:${CARD_BUCKET.fees}`,
      nombre: `${tarjeta.name} · ${etiqueta(CARD_BUCKET.fees)}`,
      tipo: 'tarjeta',
      saldo: resto,
      tasaMensual: tasaTarjeta,
      tasaConocida: Boolean(tarjeta.annualRate),
      cuotas: CUOTAS_SUPUESTAS,
      grupo: `tarjeta:${tarjeta.id}`,
      prioridad: prioridad.indexOf(CARD_BUCKET.fees),
    });
  return deudas.filter((d) => d.saldo > 0.005).sort((a, b) => (a.prioridad ?? 0) - (b.prioridad ?? 0));
}

export interface PuertaDeTarjetaSimple {
  readonly tarjeta: Account;
  readonly saldo: number;
  readonly movimientos: readonly Movement[];
}

export function DeudaDeTarjetaSimple(fuente: PuertaDeTarjetaSimple): DeudaActual {
  const { tarjeta, saldo, movimientos } = fuente;
  return {
    id: `tarjeta:${tarjeta.id}`,
    nombre: tarjeta.name,
    tipo: 'tarjeta',
    saldo: redondear(saldo),
    tasaMensual: tasaMensualDeTarjeta(tarjeta),
    tasaConocida: Boolean(tarjeta.annualRate),
    cuotas: cuotasRestantesDeTarjeta(tarjeta, movimientos),
  };
}

export interface PuertaDeAcreedores {
  readonly personas: readonly Person[];
  readonly obligaciones: readonly ApiObligation[];
}

export function DeudaPorAcreedor(fuente: PuertaDeAcreedores): DeudaActual[] {
  const { personas, obligaciones } = fuente;
  const conObligacion = new Set(obligaciones.filter((o) => o.direction === DEBO).map((o) => o.counterparty.id));
  return personas
    .filter((p) => p.owing > 0 && !conObligacion.has(p.id))
    .map<DeudaActual>((p) => ({
      id: `persona:${p.id}`,
      nombre: p.name,
      tipo: p.kind === 'institution' ? 'credito' : 'prestamo',
      saldo: redondear(p.owing),
      tasaMensual: p.kind === 'institution' ? TASA_MENSUAL_SUPUESTA_CREDITO : 0,
      tasaConocida: p.kind !== 'institution',
      cuotas: CUOTAS_SUPUESTAS,
    }));
}
