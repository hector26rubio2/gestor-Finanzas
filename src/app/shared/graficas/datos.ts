import type { Movement } from '@core/state';
import { totalDeGastos, totalDeIngresos } from '@core/state/economia';
import type { Agregado, Cruce, Dimension, Enlace, Granularidad, Measure, Nodo } from './modelo';

export interface ContextoDeDatos {
  readonly locale: string;
  readonly granularidad: Granularidad;
  readonly t: (clave: string, params?: Record<string, string | number>) => string;
  readonly nombreDeCuenta: (id: string) => string;
  readonly tipoDeCuenta: (id: string) => string;
  readonly tipoDeMovimiento: (m: Movement) => string;
}

export interface Etiquetado {
  readonly key: string;
  readonly label: string;
}

const DIMENSIONES_ORDENADAS_POR_CLAVE: readonly Dimension[] = ['date', 'weekday', 'monthOfYear', 'amountRange'];

const RANGOS_DE_IMPORTE: readonly { hasta: number; clave: string }[] = [
  { hasta: 50_000, clave: 'a' },
  { hasta: 200_000, clave: 'b' },
  { hasta: 1_000_000, clave: 'c' },
  { hasta: 5_000_000, clave: 'd' },
  { hasta: Infinity, clave: 'e' },
];

const fechaUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);

function semanaIso(fecha: Date): { anio: number; semana: number } {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { anio: d.getUTCFullYear(), semana: Math.ceil(((d.getTime() - inicio.getTime()) / 86_400_000 + 1) / 7) };
}

function fechaAgrupada(iso: string, ctx: ContextoDeDatos): Etiquetado {
  const d = fechaUtc(iso);
  const formato = (opciones: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(ctx.locale, { ...opciones, timeZone: 'UTC' }).format(d);
  switch (ctx.granularidad) {
    case 'year':
      return { key: iso.slice(0, 4), label: iso.slice(0, 4) };
    case 'quarter': {
      const trimestre = Math.floor(d.getUTCMonth() / 3) + 1;
      return { key: `${iso.slice(0, 4)}-Q${trimestre}`, label: `T${trimestre} ${iso.slice(0, 4)}` };
    }
    case 'month':
      return { key: iso.slice(0, 7), label: formato({ month: 'short', year: '2-digit' }) };
    case 'week': {
      const { anio, semana } = semanaIso(d);
      return { key: `${anio}-W${String(semana).padStart(2, '0')}`, label: `S${semana} ${String(anio).slice(2)}` };
    }
    default:
      return { key: iso, label: formato({ day: '2-digit', month: 'short' }) };
  }
}

export function etiquetaDeDimension(m: Movement, dim: Dimension, ctx: ContextoDeDatos): Etiquetado {
  switch (dim) {
    case 'date':
      return fechaAgrupada(m.date, ctx);
    case 'weekday': {
      const d = fechaUtc(m.date);
      const indice = (d.getUTCDay() + 6) % 7;
      return {
        key: String(indice),
        label: new Intl.DateTimeFormat(ctx.locale, { weekday: 'short', timeZone: 'UTC' }).format(d),
      };
    }
    case 'monthOfYear': {
      const d = fechaUtc(m.date);
      return {
        key: String(d.getUTCMonth()).padStart(2, '0'),
        label: new Intl.DateTimeFormat(ctx.locale, { month: 'short', timeZone: 'UTC' }).format(d),
      };
    }
    case 'amountRange': {
      const valor = Math.abs(m.amount);
      const rango = RANGOS_DE_IMPORTE.find((r) => valor < r.hasta) ?? RANGOS_DE_IMPORTE[RANGOS_DE_IMPORTE.length - 1];
      return { key: rango.clave, label: ctx.t(`charts.amountRange.${rango.clave}`) };
    }
    case 'category':
      return igual(m.category || ctx.t('movements.fallback.noCategory'));
    case 'account':
      return igual(ctx.nombreDeCuenta(m.accountId));
    case 'accountType':
      return igual(ctx.tipoDeCuenta(m.accountId));
    case 'kind':
      return igual(ctx.tipoDeMovimiento(m));
    case 'flow':
      return igual(ctx.t(m.amount >= 0 ? 'charts.flow.in' : 'charts.flow.out'));
    case 'recurring':
      return igual(
        ctx.t(m.recurring ? 'dashboard.dimension.recurring.fixed' : 'dashboard.dimension.recurring.variable'),
      );
    case 'installments':
      return igual(
        ctx.t(
          (m.installmentTotal ?? 1) > 1
            ? 'dashboard.dimension.installments.yes'
            : 'dashboard.dimension.installments.no',
        ),
      );
    case 'currency':
      return igual(m.originalCurrency ?? 'COP');
    case 'person':
      return igual(m.person ?? ctx.t('dashboard.person.none'));
  }
}

const igual = (texto: string): Etiquetado => ({ key: texto, label: texto });

const suma = (valores: readonly number[]) => valores.reduce((s, v) => s + v, 0);

export function valorDeMedida(filas: readonly Movement[], medida: Measure): number {
  switch (medida) {
    case 'amount':
      return suma(filas.map((m) => Math.abs(m.amount)));
    case 'net':
      return totalDeIngresos(filas) - totalDeGastos(filas);
    case 'expense':
      return totalDeGastos(filas);
    case 'income':
      return totalDeIngresos(filas);
    case 'count':
      return filas.length;
    case 'average':
      return filas.length ? suma(filas.map((m) => Math.abs(m.amount))) / filas.length : 0;
    case 'max':
      return filas.length ? Math.max(...filas.map((m) => Math.abs(m.amount))) : 0;
    case 'median': {
      if (!filas.length) return 0;
      const ordenados = filas.map((m) => Math.abs(m.amount)).sort((a, b) => a - b);
      const medio = Math.floor(ordenados.length / 2);
      return ordenados.length % 2 ? ordenados[medio] : (ordenados[medio - 1] + ordenados[medio]) / 2;
    }
  }
}

function seOrdenaPorClave(dim: Dimension): boolean {
  return DIMENSIONES_ORDENADAS_POR_CLAVE.includes(dim);
}

function agrupar(movs: readonly Movement[], dim: Dimension, ctx: ContextoDeDatos) {
  const grupos = new Map<string, { label: string; filas: Movement[] }>();
  for (const m of movs) {
    const { key, label } = etiquetaDeDimension(m, dim, ctx);
    const grupo = grupos.get(key) ?? { label, filas: [] };
    grupo.filas.push(m);
    grupos.set(key, grupo);
  }
  return grupos;
}

export function agregar(movs: readonly Movement[], dim: Dimension, medida: Measure, ctx: ContextoDeDatos): Agregado[] {
  const filas = [...agrupar(movs, dim, ctx)].map(([key, { label, filas }]) => ({
    key,
    label,
    value: valorDeMedida(filas, medida),
  }));
  return seOrdenaPorClave(dim)
    ? filas.sort((a, b) => a.key.localeCompare(b.key))
    : filas.sort((a, b) => b.value - a.value);
}

export function cruzar(
  movs: readonly Movement[],
  dim: Dimension,
  dim2: Dimension,
  medida: Measure,
  ctx: ContextoDeDatos,
  limite = 12,
): Cruce {
  const ejes = agregar(movs, dim, medida, ctx);
  const categorias = seOrdenaPorClave(dim) ? ejes : ejes.slice(0, limite);
  const seriesPorClave = agregar(movs, dim2, medida, ctx).slice(0, seOrdenaPorClave(dim2) ? 24 : 8);
  const celdas = new Map<string, Movement[]>();
  for (const m of movs) {
    const clave = etiquetaDeDimension(m, dim, ctx).key + '\u0000' + etiquetaDeDimension(m, dim2, ctx).key;
    const lista = celdas.get(clave) ?? [];
    lista.push(m);
    celdas.set(clave, lista);
  }
  return {
    categories: categorias.map((c) => c.label),
    series: seriesPorClave.map((s) => ({
      name: s.label,
      data: categorias.map((c) => valorDeMedida(celdas.get(c.key + '\u0000' + s.key) ?? [], medida)),
    })),
  };
}

export function jerarquia(
  movs: readonly Movement[],
  dims: readonly Dimension[],
  medida: Measure,
  ctx: ContextoDeDatos,
  limite = 10,
): Nodo[] {
  const [dim, ...resto] = dims;
  if (!dim) return [];
  return [...agrupar(movs, dim, ctx)]
    .map(([, { label, filas }]) => ({
      name: label,
      value: valorDeMedida(filas, medida),
      ...(resto.length ? { children: jerarquia(filas, resto, medida, ctx, limite) } : {}),
    }))
    .filter((nodo) => nodo.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limite);
}

export function enlaces(
  movs: readonly Movement[],
  origen: Dimension,
  destino: Dimension,
  medida: Measure,
  ctx: ContextoDeDatos,
  limite = 24,
): { nodos: string[]; enlaces: Enlace[] } {
  const pares = new Map<string, { source: string; target: string; filas: Movement[] }>();
  for (const m of movs) {
    const source = PREFIJO_ORIGEN + etiquetaDeDimension(m, origen, ctx).label;
    const target = PREFIJO_DESTINO + etiquetaDeDimension(m, destino, ctx).label;
    const clave = source + '\u0000' + target;
    const par = pares.get(clave) ?? { source, target, filas: [] };
    par.filas.push(m);
    pares.set(clave, par);
  }
  const lista = [...pares.values()]
    .map((p) => ({ source: p.source, target: p.target, value: valorDeMedida(p.filas, medida) }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limite);
  return { nodos: [...new Set(lista.flatMap((e) => [e.source, e.target]))], enlaces: lista };
}

const PREFIJO_ORIGEN = 'o|';
const PREFIJO_DESTINO = 'd|';
export const sinPrefijo = (nombre: string) => nombre.slice(2);

export function distribucion(
  movs: readonly Movement[],
  dim: Dimension,
  ctx: ContextoDeDatos,
  limite = 10,
): { categorias: string[]; cajas: number[][]; atipicos: [number, number][] } {
  const grupos = [...agrupar(movs, dim, ctx)]
    .map(([key, { label, filas }]) => ({
      key,
      label,
      montos: filas.map((m) => Math.abs(m.amount)).sort((a, b) => a - b),
    }))
    .filter((g) => g.montos.length)
    .sort((a, b) => (seOrdenaPorClave(dim) ? a.key.localeCompare(b.key) : b.montos.length - a.montos.length))
    .slice(0, limite);
  const cuantil = (orden: number[], q: number) => {
    const pos = (orden.length - 1) * q;
    const base = Math.floor(pos);
    const resto = pos - base;
    return orden[base] + (orden[base + 1] !== undefined ? resto * (orden[base + 1] - orden[base]) : 0);
  };
  const atipicos: [number, number][] = [];
  const cajas = grupos.map((g, indice) => {
    const q1 = cuantil(g.montos, 0.25);
    const q2 = cuantil(g.montos, 0.5);
    const q3 = cuantil(g.montos, 0.75);
    const rango = q3 - q1;
    const bajo = Math.max(g.montos[0], q1 - 1.5 * rango);
    const alto = Math.min(g.montos[g.montos.length - 1], q3 + 1.5 * rango);
    for (const valor of g.montos) if (valor < bajo || valor > alto) atipicos.push([indice, valor]);
    return [bajo, q1, q2, q3, alto];
  });
  return { categorias: grupos.map((g) => g.label), cajas, atipicos };
}

export function porDia(movs: readonly Movement[], medida: Measure): [string, number][] {
  const dias = new Map<string, Movement[]>();
  for (const m of movs) dias.set(m.date, [...(dias.get(m.date) ?? []), m]);
  return [...dias].map(([dia, filas]) => [dia, valorDeMedida(filas, medida)] as [string, number]).sort();
}

export function velas(
  movs: readonly Movement[],
  ctx: ContextoDeDatos,
  saldoInicial = 0,
): { etiquetas: string[]; velas: [number, number, number, number][] } {
  const orden = [...movs].sort((a, b) => a.date.localeCompare(b.date));
  const etiquetas: string[] = [];
  const lista: [number, number, number, number][] = [];
  let saldo = saldoInicial;
  let actual = '';
  for (const m of orden) {
    const { key, label } = fechaAgrupada(m.date, ctx);
    if (key !== actual) {
      actual = key;
      etiquetas.push(label);
      lista.push([saldo, saldo, saldo, saldo]);
    }
    saldo += m.amount;
    const vela = lista[lista.length - 1];
    vela[1] = saldo;
    vela[2] = Math.min(vela[2], saldo);
    vela[3] = Math.max(vela[3], saldo);
  }
  return { etiquetas, velas: lista };
}

export function burbujas(
  movs: readonly Movement[],
  dim: Dimension,
  ctx: ContextoDeDatos,
  limite = 16,
): { nombre: string; cantidad: number; promedio: number; total: number }[] {
  return [...agrupar(movs, dim, ctx)]
    .map(([, { label, filas }]) => ({
      nombre: label,
      cantidad: filas.length,
      promedio: valorDeMedida(filas, 'average'),
      total: valorDeMedida(filas, 'amount'),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

export function cubetas(movs: readonly Movement[], cantidad = 10): { etiquetas: [number, number][]; conteo: number[] } {
  const montos = movs
    .map((m) => Math.abs(m.amount))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const max = montos.length ? montos[Math.max(0, Math.ceil(montos.length * 0.95) - 1)] : 0;
  const ancho = max / cantidad || 1;
  const conteo = Array.from({ length: cantidad }, () => 0);
  for (const valor of montos) conteo[Math.min(cantidad - 1, Math.floor(valor / ancho))]++;
  return { etiquetas: conteo.map((_, i) => [i * ancho, (i + 1) * ancho]), conteo };
}
