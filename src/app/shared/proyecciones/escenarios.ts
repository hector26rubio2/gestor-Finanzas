import type { ApiObligation, ApiRecurrence } from '@core/api';
import type { Account, Movement, Person } from '@core/state';
import { sumBy } from '@core/utils';
import { mensualDesdeAnual } from '@core/utils/tasas';
import { type Deuda, type Flujo, type Palanca, cuotaFija, proyectar } from './amortizacion';
import { CARD_BUCKET, PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS, completarPrioridad } from '@core/api';
import { type CompraPendiente, comprasPendientes, saldosPorConcepto } from '@shared/tarjetas/extracto';

export const TASA_MENSUAL_SUPUESTA_TARJETA = 2.5;
export const TASA_MENSUAL_SUPUESTA_CREDITO = 1.5;
export const CUOTAS_SUPUESTAS = 12;

export interface FlujoMensual {
  readonly ingresoMensual: number;
  readonly gastoMensual: number;
  readonly mesesMedidos: number;
}

export interface LineaDeFlujo {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: 'ingreso' | 'gasto';
  readonly monto: number;
}

export interface RecurrenteDeFlujo extends LineaDeFlujo {
  readonly desde: number;
}

export interface CambioDeFlujo extends LineaDeFlujo {
  readonly desde: number;
  readonly hasta: number | null;
}

export interface AjusteDeLinea {
  readonly incluida: boolean;
  readonly monto: number;
}

export interface FlujoPorMes {
  readonly ingreso: readonly number[];
  readonly gasto: readonly number[];
  readonly gastoPorLinea: readonly { readonly nombre: string; readonly valores: readonly number[] }[];
}

export interface DeudaActual extends Deuda {
  readonly tasaConocida: boolean;
}

export type OrdenDeAbono = 'tasa' | 'saldo';

export interface PuntoDeInversion {
  readonly valor: number;
  readonly aportado: number;
}

export interface ProyeccionDeInversion {
  readonly puntos: readonly PuntoDeInversion[];
  readonly valorFinal: number;
  readonly aportadoFinal: number;
  readonly rendimiento: number;
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

const mesAnterior = (mes: string, atras: number): string => {
  const [anio, numero] = mes.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, numero - 1 - atras, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
};

function flujoDeMeses(movimientos: readonly Movement[], meses: readonly string[]): FlujoMensual {
  const delPeriodo = movimientos.filter((m) => !m.movementSubtype && !m.loanRole && meses.includes(m.date.slice(0, 7)));
  const conDatos = new Set(delPeriodo.map((m) => m.date.slice(0, 7))).size;
  const divisor = Math.max(1, conDatos);
  return {
    ingresoMensual: redondear(
      sumBy(
        delPeriodo.filter((m) => m.kind === 'income'),
        (m) => m.amount,
      ) / divisor,
    ),
    gastoMensual: redondear(
      sumBy(
        delPeriodo.filter((m) => m.kind === 'expense'),
        (m) => Math.abs(m.amount),
      ) / divisor,
    ),
    mesesMedidos: conDatos,
  };
}

export function flujoPromedio(movimientos: readonly Movement[], hoy: string, meses = 3): FlujoMensual {
  const mesActual = hoy.slice(0, 7);
  const cerrados = flujoDeMeses(
    movimientos,
    Array.from({ length: meses }, (_, i) => mesAnterior(mesActual, i + 1)),
  );
  return cerrados.mesesMedidos > 0 ? cerrados : flujoDeMeses(movimientos, [mesActual]);
}

export function lineasPorCategoria(movimientos: readonly Movement[], hoy: string, meses = 3): LineaDeFlujo[] {
  const mesActual = hoy.slice(0, 7);
  const cerrados = Array.from({ length: meses }, (_, i) => mesAnterior(mesActual, i + 1));
  const conCerrados = movimientos.some((m) => cerrados.includes(m.date.slice(0, 7)));
  const ventana = conCerrados ? cerrados : [mesActual];
  const delPeriodo = movimientos.filter(
    (m) =>
      !m.movementSubtype &&
      !m.loanRole &&
      (m.kind === 'income' || m.kind === 'expense') &&
      ventana.includes(m.date.slice(0, 7)),
  );
  const divisor = Math.max(1, new Set(delPeriodo.map((m) => m.date.slice(0, 7))).size);
  const grupos = new Map<string, Movement[]>();
  for (const m of delPeriodo) {
    const clave = `${m.kind}|${m.category || '—'}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), m]);
  }
  return [...grupos.entries()]
    .map<LineaDeFlujo>(([clave, lista]) => {
      const [kind, categoria] = clave.split('|');
      return {
        id: `categoria:${clave}`,
        nombre: categoria,
        tipo: kind === 'income' ? 'ingreso' : 'gasto',
        monto: Math.round(sumBy(lista, (m) => Math.abs(m.amount)) / divisor),
      };
    })
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || b.monto - a.monto);
}

const VECES_AL_MES: Record<number, number> = { 1: 30, 2: 52 / 12, 3: 1, 4: 1 / 12 };
const PLANTILLA_INGRESO = 1;
const UNA_PATA = 1;

export function recurrentesDeFlujo(recurrentes: readonly ApiRecurrence[], hoy: string): RecurrenteDeFlujo[] {
  return recurrentes
    .filter((r) => r.isActive !== false && r.kind === UNA_PATA && r.movementTemplate !== null)
    .map<RecurrenteDeFlujo>((r) => ({
      id: `recurrente:${r.id}`,
      nombre: r.name,
      tipo: r.movementTemplate === PLANTILLA_INGRESO ? 'ingreso' : 'gasto',
      monto: redondear(
        (Number(r.amount.amount) * (VECES_AL_MES[r.schedule.frequency] ?? 1)) / Math.max(1, r.schedule.interval),
      ),
      desde: Math.max(0, diferenciaDeMesesCalendario(hoy, r.schedule.start)),
    }));
}

const diferenciaDeMesesCalendario = (desde: string, hasta: string): number => {
  const [a1, m1] = desde.split('-').map(Number);
  const [a2, m2] = hasta.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
};

export function flujoPorMes(
  categorias: readonly LineaDeFlujo[],
  ajustes: Readonly<Record<string, AjusteDeLinea>>,
  recurrentesQuitados: readonly RecurrenteDeFlujo[],
  cambios: readonly CambioDeFlujo[],
  meses: number,
): FlujoPorMes {
  const vigente = (linea: LineaDeFlujo) => {
    const ajuste = ajustes[linea.id];
    return ajuste ? (ajuste.incluida ? ajuste.monto : 0) : linea.monto;
  };
  const activo = (desde: number, hasta: number | null, mes: number) => mes >= desde && (hasta === null || mes <= hasta);
  const porTipo = (tipo: LineaDeFlujo['tipo']) =>
    Array.from({ length: meses }, (_, mes) =>
      redondear(
        sumBy(
          categorias.filter((c) => c.tipo === tipo),
          vigente,
        ) -
          sumBy(
            recurrentesQuitados.filter((r) => r.tipo === tipo && mes >= r.desde),
            (r) => r.monto,
          ) +
          sumBy(
            cambios.filter((c) => c.tipo === tipo && activo(c.desde, c.hasta, mes)),
            (c) => c.monto,
          ),
      ),
    );
  const gastoPorLinea = [
    ...categorias
      .filter((c) => c.tipo === 'gasto')
      .map((c) => ({ nombre: c.nombre, valores: Array.from({ length: meses }, () => vigente(c)) })),
    ...cambios
      .filter((c) => c.tipo === 'gasto')
      .map((c) => ({
        nombre: c.nombre,
        valores: Array.from({ length: meses }, (_, mes) => (activo(c.desde, c.hasta, mes) ? c.monto : 0)),
      })),
    ...recurrentesQuitados
      .filter((r) => r.tipo === 'gasto')
      .map((r) => ({
        nombre: r.nombre,
        valores: Array.from({ length: meses }, (_, mes) => (mes >= r.desde ? -r.monto : 0)),
      })),
  ].filter((linea) => linea.valores.some((v) => v !== 0));
  return {
    ingreso: porTipo('ingreso').map((v) => Math.max(0, v)),
    gasto: porTipo('gasto').map((v) => Math.max(0, v)),
    gastoPorLinea,
  };
}

const cuotasRestantesDeTarjeta = (tarjeta: Account, movimientos: readonly Movement[]): number => {
  const restantes = movimientos
    .filter((m) => m.accountId === tarjeta.id && m.installmentTotal && m.installmentTotal > 1)
    .map((m) => (m.installmentTotal ?? 0) - (m.installmentCurrent ?? 1) + 1);
  return restantes.length ? Math.max(1, ...restantes) : CUOTAS_SUPUESTAS;
};

const DEBO = 2;
const ABIERTA = 1;
const PERIODO_MENSUAL = 2;
const SIN_INTERES = 0;

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

export function deudasDeObligaciones(obligaciones: readonly ApiObligation[], hoy: string): DeudaActual[] {
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
        saldo: plazo ? saldoTrasCuotas(capital, tasaMensual, plazo, pagadas) : capital,
        tasaMensual,
        tasaConocida: Boolean(vigente),
        cuotas: plazo ? Math.max(1, plazo - pagadas) : CUOTAS_SUPUESTAS,
      };
    })
    .filter((d) => d.saldo > 0);
}

export interface TarjetasPorConcepto {
  readonly movimientos: readonly Movement[];
  readonly etiqueta: (concepto: number) => string;
}

export function deudasDeTarjeta(
  tarjeta: Account,
  saldoTotal: number,
  movimientos: readonly Movement[],
  etiqueta: (concepto: number) => string,
): DeudaActual[] {
  const tasaTarjeta = tarjeta.annualRate ? mensualDesdeAnual(tarjeta.annualRate) : TASA_MENSUAL_SUPUESTA_TARJETA;
  const prioridad =
    tarjeta.currency && tarjeta.currency !== 'COP'
      ? completarPrioridad(tarjeta.foreignPaymentPriority, PRIORIDAD_EN_DOLARES)
      : completarPrioridad(tarjeta.paymentPriority, PRIORIDAD_EN_PESOS);
  const compras = comprasPendientes(movimientos.filter((m) => m.accountId === tarjeta.id));
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

const SIN_INTERES_EN: readonly number[] = [CARD_BUCKET.zeroRatePurchases, CARD_BUCKET.singleInstallmentPurchases];

export function deudasActuales(
  cuentas: readonly Account[],
  personas: readonly Person[],
  movimientos: readonly Movement[],
  saldo: (cuenta: Account) => number,
  obligaciones: readonly ApiObligation[] = [],
  hoy = '',
  porConcepto?: TarjetasPorConcepto,
): DeudaActual[] {
  const conObligacion = new Set(obligaciones.filter((o) => o.direction === DEBO).map((o) => o.counterparty.id));
  const deudaDeTarjetaCompleta = (c: Account): DeudaActual => ({
    id: `tarjeta:${c.id}`,
    nombre: c.name,
    tipo: 'tarjeta',
    saldo: redondear(-saldo(c)),
    tasaMensual: c.annualRate ? mensualDesdeAnual(c.annualRate) : TASA_MENSUAL_SUPUESTA_TARJETA,
    tasaConocida: Boolean(c.annualRate),
    cuotas: cuotasRestantesDeTarjeta(c, movimientos),
  });
  const tarjetas = cuentas
    .filter((c) => c.type === 'credit' && saldo(c) < 0)
    .flatMap<DeudaActual>((c) =>
      porConcepto
        ? deudasDeTarjeta(c, redondear(-saldo(c)), porConcepto.movimientos, porConcepto.etiqueta)
        : [deudaDeTarjetaCompleta(c)],
    );
  const acreedores = personas
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
  return [...tarjetas, ...deudasDeObligaciones(obligaciones, hoy), ...acreedores];
}

const grupoDe = (deuda: Deuda) => deuda.grupo ?? deuda.id;

export function ordenarParaAbono(deudas: readonly Deuda[], orden: OrdenDeAbono): Deuda[] {
  const grupos = new Map<string, { tasa: number; saldo: number }>();
  for (const deuda of deudas) {
    const actual = grupos.get(grupoDe(deuda)) ?? { tasa: 0, saldo: 0 };
    grupos.set(grupoDe(deuda), { tasa: Math.max(actual.tasa, deuda.tasaMensual), saldo: actual.saldo + deuda.saldo });
  }
  return [...deudas].sort((a, b) => {
    const ga = grupos.get(grupoDe(a))!;
    const gb = grupos.get(grupoDe(b))!;
    const porGrupo =
      orden === 'tasa' ? gb.tasa - ga.tasa || ga.saldo - gb.saldo : ga.saldo - gb.saldo || gb.tasa - ga.tasa;
    if (porGrupo !== 0) return porGrupo;
    if (grupoDe(a) !== grupoDe(b)) return grupoDe(a).localeCompare(grupoDe(b));
    return (a.prioridad ?? 0) - (b.prioridad ?? 0);
  });
}

const ordenar = ordenarParaAbono;

export function planDeAbonos(
  deudas: readonly Deuda[],
  flujo: Flujo,
  meses: number,
  abonoMensual: number,
  orden: OrdenDeAbono,
): Palanca[] {
  if (abonoMensual <= 0 || !deudas.length) return [];
  const prioridad = ordenar(deudas, orden);
  const palancas: Palanca[] = [];
  for (let mes = 0; mes < meses; mes++) {
    const hastaAqui = proyectar(deudas, palancas, flujo, mes + 1);
    let disponible = abonoMensual;
    for (const deuda of prioridad) {
      if (disponible <= 0) break;
      const serie = hastaAqui.deudas.find((s) => s.id === deuda.id);
      const pendiente = serie?.saldo[mes] ?? 0;
      if (pendiente <= 0.005) continue;
      const monto = redondear(Math.min(disponible, pendiente));
      palancas.push({ tipo: 'abono', id: `abono:${deuda.id}:${mes}`, deudaId: deuda.id, mes, monto });
      disponible = redondear(disponible - monto);
    }
    if (disponible === abonoMensual) break;
  }
  return palancas;
}

export function horizonteDeDeudas(deudas: readonly Deuda[], extra = 0): number {
  const mayor = Math.max(0, ...deudas.map((d) => (d.desdeMes ?? 0) + d.cuotas));
  return Math.min(360, Math.max(12, mayor + extra));
}

export function cuotaParaTerminarEn(deudas: readonly Deuda[], meses: number): number {
  return Math.round(sumBy(deudas, (d) => cuotaFija(d.saldo, d.tasaMensual, Math.max(1, meses))));
}

export function mesesHasta(hoy: string, objetivo: string): number {
  const [a1, m1] = hoy.split('-').map(Number);
  const [a2, m2] = objetivo.split('-').map(Number);
  return Math.max(1, (a2 - a1) * 12 + (m2 - m1));
}

export function proyectarInversion(
  inicial: number,
  aporteMensual: number,
  tasaAnual: number,
  meses: number,
): ProyeccionDeInversion {
  const tasa = (1 + tasaAnual / 100) ** (1 / 12) - 1;
  const puntos: PuntoDeInversion[] = [{ valor: redondear(inicial), aportado: redondear(inicial) }];
  let valor = inicial;
  let aportado = inicial;
  for (let mes = 1; mes <= meses; mes++) {
    valor = valor * (1 + tasa) + aporteMensual;
    aportado += aporteMensual;
    puntos.push({ valor: redondear(valor), aportado: redondear(aportado) });
  }
  const ultimo = puntos[puntos.length - 1];
  return {
    puntos,
    valorFinal: ultimo.valor,
    aportadoFinal: ultimo.aportado,
    rendimiento: redondear(ultimo.valor - ultimo.aportado),
  };
}

export function tasaPromedioDeInversiones(
  inversiones: readonly { value: number; annualRate?: number }[],
  respaldo: number,
): number {
  const conTasa = inversiones.filter((i) => i.annualRate !== undefined && i.value > 0);
  const total = sumBy(conTasa, (i) => i.value);
  if (total <= 0) return respaldo;
  return Math.round((sumBy(conTasa, (i) => i.value * (i.annualRate ?? 0)) / total) * 100) / 100;
}

export function cuotasDeManejo(cuentas: readonly Account[], etiqueta: (tarjeta: string) => string): LineaDeFlujo[] {
  return cuentas
    .filter((c) => c.type === 'credit' && (c.monthlyFee ?? 0) > 0)
    .map((c) => ({ id: `cuota:${c.id}`, nombre: etiqueta(c.name), tipo: 'gasto' as const, monto: c.monthlyFee ?? 0 }));
}
