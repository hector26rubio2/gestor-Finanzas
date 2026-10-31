export type TipoDeDeuda = 'credito' | 'tarjeta' | 'prestamo' | 'hipotetica';

export interface Deuda {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: TipoDeDeuda;
  readonly saldo: number;
  readonly tasaMensual: number;
  readonly cuotas: number;
  readonly desdeMes?: number;
  readonly grupo?: string;
  readonly prioridad?: number;
}

export type Palanca =
  | {
      readonly tipo: 'abono';
      readonly id: string;
      readonly deudaId: string;
      readonly mes: number;
      readonly monto: number;
    }
  | {
      readonly tipo: 'tasa';
      readonly id: string;
      readonly deudaId: string;
      readonly mes: number;
      readonly tasaMensual: number;
    }
  | {
      readonly tipo: 'compra';
      readonly id: string;
      readonly nombre: string;
      readonly mes: number;
      readonly monto: number;
      readonly cuotas: number;
      readonly tasaMensual: number;
    };

export interface Flujo {
  readonly ingresoMensual: number;
  readonly gastoMensual: number;
  readonly recorteDeGasto: number;
  readonly metaDeAhorro: number;
  readonly ahorroInicial?: number;
  readonly ingresoPorMes?: readonly number[];
  readonly gastoPorMes?: readonly number[];
}

export interface SerieDeDeuda {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: TipoDeDeuda;
  readonly saldo: readonly number[];
  readonly interes: readonly number[];
  readonly capital: readonly number[];
  readonly abonos: readonly number[];
  readonly interesTotal: number;
  readonly mesFinal: number | null;
  readonly inicio: number;
}

export interface Proyeccion {
  readonly meses: number;
  readonly deudas: readonly SerieDeDeuda[];
  readonly saldoTotal: readonly number[];
  readonly cuotaTotal: readonly number[];
  readonly interesTotal: number;
  readonly mesSinDeudas: number | null;
  readonly flujoLibre: readonly number[];
  readonly ahorroAcumulado: readonly number[];
  readonly mesDeMeta: number | null;
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

export function cuotaFija(saldo: number, tasaMensual: number, cuotas: number): number {
  if (saldo <= 0 || cuotas <= 0) return 0;
  const i = tasaMensual / 100;
  if (i === 0) return saldo / cuotas;
  return (saldo * i) / (1 - (1 + i) ** -cuotas);
}

interface PalancasPorMes {
  readonly tasas: ReadonlyMap<string, number>;
  readonly abonos: ReadonlyMap<string, number>;
}

const claveDeMes = (deudaId: string, mes: number) => `${deudaId}:${mes}`;

function indexarPalancas(palancas: readonly Palanca[]): PalancasPorMes {
  const tasas = new Map<string, number>();
  const abonos = new Map<string, number>();
  for (const p of palancas) {
    if (p.tipo === 'compra') continue;
    const clave = claveDeMes(p.deudaId, p.mes);
    if (p.tipo === 'tasa' && !tasas.has(clave)) tasas.set(clave, p.tasaMensual);
    if (p.tipo === 'abono') abonos.set(clave, (abonos.get(clave) ?? 0) + p.monto);
  }
  return { tasas, abonos };
}

export class CursorDeDeuda {
  readonly inicio: number;
  pendiente: number;
  private tasa: number;
  private restantes: number;
  private cuota: number;

  constructor(deuda: Deuda) {
    this.inicio = Math.max(0, deuda.desdeMes ?? 0);
    this.pendiente = deuda.saldo;
    this.tasa = deuda.tasaMensual;
    this.restantes = Math.max(1, Math.round(deuda.cuotas));
    this.cuota = cuotaFija(this.pendiente, this.tasa, this.restantes);
  }

  cobrar(mes: number, tasaNueva?: number): { interes: number; capital: number } | null {
    if (mes < this.inicio) return null;
    if (tasaNueva !== undefined) {
      this.tasa = tasaNueva;
      this.cuota = cuotaFija(this.pendiente, this.tasa, this.restantes);
    }
    if (this.pendiente <= 0.005) return null;
    const interes = this.pendiente * (this.tasa / 100);
    const capital = Math.min(this.pendiente, Math.max(0, this.cuota - interes));
    this.pendiente -= capital;
    this.restantes = Math.max(1, this.restantes - 1);
    return { interes, capital };
  }

  abonar(extra: number): number {
    const abono = Math.min(this.pendiente, Math.max(0, extra));
    this.pendiente -= abono;
    return abono;
  }
}

function simularDeuda(deuda: Deuda, palancas: PalancasPorMes, meses: number): SerieDeDeuda {
  const cursor = new CursorDeDeuda(deuda);
  const inicio = cursor.inicio;
  const saldo: number[] = [];
  const interes: number[] = [];
  const capital: number[] = [];
  const abonos: number[] = [];
  let mesFinal: number | null = deuda.saldo <= 0 ? 0 : null;
  for (let mes = 0; mes < meses; mes++) {
    const paso = cursor.cobrar(mes, palancas.tasas.get(claveDeMes(deuda.id, mes)));
    if (!paso) {
      saldo.push(0);
      interes.push(0);
      capital.push(0);
      abonos.push(0);
      continue;
    }
    const abono = cursor.abonar(palancas.abonos.get(claveDeMes(deuda.id, mes)) ?? 0);
    interes.push(redondear(paso.interes));
    capital.push(redondear(paso.capital));
    abonos.push(redondear(abono));
    saldo.push(redondear(Math.max(0, cursor.pendiente)));
    if (cursor.pendiente <= 0.005 && mesFinal === null) mesFinal = mes;
  }
  return {
    id: deuda.id,
    nombre: deuda.nombre,
    tipo: deuda.tipo,
    saldo,
    interes,
    capital,
    abonos,
    interesTotal: redondear(interes.reduce((s, v) => s + v, 0)),
    mesFinal,
    inicio,
  };
}

export function proyectar(
  deudas: readonly Deuda[],
  palancas: readonly Palanca[],
  flujo: Flujo,
  meses: number,
): Proyeccion {
  const compras: Deuda[] = palancas.flatMap((p) =>
    p.tipo === 'compra'
      ? [
          {
            id: p.id,
            nombre: p.nombre,
            tipo: 'hipotetica' as const,
            saldo: p.monto,
            tasaMensual: p.tasaMensual,
            cuotas: p.cuotas,
            desdeMes: p.mes,
          },
        ]
      : [],
  );
  const indice = indexarPalancas(palancas);
  const series = [...deudas, ...compras].map((deuda) => simularDeuda(deuda, indice, meses));
  const porMes = (seleccion: (serie: SerieDeDeuda, mes: number) => number) =>
    Array.from({ length: meses }, (_, mes) => redondear(series.reduce((s, serie) => s + seleccion(serie, mes), 0)));
  const saldoTotal = porMes((serie, mes) => serie.saldo[mes]);
  const cuotaTotal = porMes((serie, mes) => serie.interes[mes] + serie.capital[mes] + serie.abonos[mes]);
  const factorDeGasto = 1 - flujo.recorteDeGasto / 100;
  const flujoLibre = cuotaTotal.map((cuota, mes) => {
    const ingreso = flujo.ingresoPorMes?.[mes] ?? flujo.ingresoMensual;
    const gasto = (flujo.gastoPorMes?.[mes] ?? flujo.gastoMensual) * factorDeGasto;
    return redondear(ingreso - gasto - cuota);
  });
  const ahorroAcumulado: number[] = [];
  flujoLibre.reduce((acumulado, libre) => {
    const siguiente = redondear(acumulado + libre);
    ahorroAcumulado.push(siguiente);
    return siguiente;
  }, flujo.ahorroInicial ?? 0);
  const mesSinDeudas = saldoTotal.findIndex((s, mes) => s <= 0.005 && series.every((serie) => mes >= serie.inicio));
  const mesDeMeta = flujo.metaDeAhorro > 0 ? ahorroAcumulado.findIndex((a) => a >= flujo.metaDeAhorro) : -1;
  return {
    meses,
    deudas: series,
    saldoTotal,
    cuotaTotal,
    interesTotal: redondear(series.reduce((s, serie) => s + serie.interesTotal, 0)),
    mesSinDeudas: mesSinDeudas < 0 ? null : mesSinDeudas,
    flujoLibre,
    ahorroAcumulado,
    mesDeMeta: mesDeMeta < 0 ? null : mesDeMeta,
  };
}
