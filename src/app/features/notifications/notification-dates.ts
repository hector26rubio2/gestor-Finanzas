export type GrupoDeFecha = 'today' | 'yesterday' | 'week' | 'older';

const ORDEN: readonly GrupoDeFecha[] = ['today', 'yesterday', 'week', 'older'];
const DIA_MS = 86_400_000;

function inicioDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

export function grupoDe(fechaIso: string, ahora: Date): GrupoDeFecha {
  const dias = Math.round((inicioDelDia(ahora) - inicioDelDia(new Date(fechaIso))) / DIA_MS);
  if (dias <= 0) return 'today';
  if (dias === 1) return 'yesterday';
  if (dias < 7) return 'week';
  return 'older';
}

export function agruparPorFecha<T extends { createdAt: string }>(
  elementos: readonly T[],
  ahora: Date,
): { clave: GrupoDeFecha; elementos: T[] }[] {
  const grupos = new Map<GrupoDeFecha, T[]>();
  for (const elemento of elementos) {
    const clave = grupoDe(elemento.createdAt, ahora);
    grupos.set(clave, [...(grupos.get(clave) ?? []), elemento]);
  }
  return ORDEN.filter((clave) => grupos.has(clave)).map((clave) => ({ clave, elementos: grupos.get(clave)! }));
}

const UNIDADES: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * DIA_MS],
  ['month', 30 * DIA_MS],
  ['week', 7 * DIA_MS],
  ['day', DIA_MS],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export function haceCuanto(fechaIso: string, ahora: Date, locale: string): string {
  const diferencia = new Date(fechaIso).getTime() - ahora.getTime();
  const formato = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unidad, ms] of UNIDADES) {
    if (Math.abs(diferencia) >= ms) return formato.format(Math.round(diferencia / ms), unidad);
  }
  return formato.format(0, 'minute');
}
