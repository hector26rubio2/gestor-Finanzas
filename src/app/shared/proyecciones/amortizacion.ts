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

function simularDeuda(deuda: Deuda, palancas: readonly Palanca[], meses: number): SerieDeDeuda {
  const inicio = Math.max(0, deuda.desdeMes ?? 0);
  const saldo: number[] = [];
  const interes: number[] = [];
  const capital: number[] = [];
  const abonos: number[] = [];
  let pendiente = deuda.saldo;
  let tasa = deuda.tasaMensual;
  let restantes = Math.max(1, Math.round(deuda.cuotas));
  let cuota = cuotaFija(pendiente, tasa, restantes);
  let mesFinal: number | null = pendiente <= 0 ? 0 : null;
  for (let mes = 0; mes < meses; mes++) {
    if (mes < inicio) {
      saldo.push(0);
      interes.push(0);
      capital.push(0);
      abonos.push(0);
      continue;
    }
    const cambio = palancas.find((p) => p.tipo === 'tasa' && p.deudaId === deuda.id && p.mes === mes);
    if (cambio && cambio.tipo === 'tasa') {
      tasa = cambio.tasaMensual;
      cuota = cuotaFija(pendiente, tasa, restantes);
    }
    if (pendiente <= 0.005) {
      saldo.push(0);
      interes.push(0);
      capital.push(0);
      abonos.push(0);
      continue;
    }
    const interesDelMes = pendiente * (tasa / 100);
    const capitalDelMes = Math.min(pendiente, Math.max(0, cuota - interesDelMes));
    pendiente -= capitalDelMes;
    restantes = Math.max(1, restantes - 1);
    const extra = palancas
      .filter((p) => p.tipo === 'abono' && p.deudaId === deuda.id && p.mes === mes)
      .reduce((suma, p) => suma + (p.tipo === 'abono' ? p.monto : 0), 0);
    const abono = Math.min(pendiente, Math.max(0, extra));
    pendiente -= abono;
    interes.push(redondear(interesDelMes));
    capital.push(redondear(capitalDelMes));
    abonos.push(redondear(abono));
    saldo.push(redondear(Math.max(0, pendiente)));
    if (pendiente <= 0.005 && mesFinal === null) mesFinal = mes;
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
  const series = [...deudas, ...compras].map((deuda) => simularDeuda(deuda, palancas, meses));
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
  }, 0);
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
