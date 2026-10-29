import { addMonthsToIso } from '@core/utils/dates';

export const PRESETS_DE_PERIODO = ['month', 'quarter', 'year', 'last3', 'last6', 'last12', 'custom'] as const;
export type PresetDePeriodo = (typeof PRESETS_DE_PERIODO)[number];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (anio: number, mes: number, dia: number) => new Date(Date.UTC(anio, mes, dia));

export function rangoDePreset(preset: PresetDePeriodo, ancla: string): { start: string; end: string } {
  const d = new Date(`${ancla}T12:00:00Z`);
  const anio = d.getUTCFullYear();
  const mes = d.getUTCMonth();
  switch (preset) {
    case 'month':
      return { start: iso(utc(anio, mes, 1)), end: iso(utc(anio, mes + 1, 0)) };
    case 'quarter': {
      const inicio = Math.floor(mes / 3) * 3;
      return { start: iso(utc(anio, inicio, 1)), end: iso(utc(anio, inicio + 3, 0)) };
    }
    case 'year':
      return { start: `${anio}-01-01`, end: `${anio}-12-31` };
    case 'last3':
    case 'last6':
    case 'last12': {
      const meses = Number(preset.slice(4));
      return { start: iso(utc(anio, mes - meses + 1, 1)), end: iso(utc(anio, mes + 1, 0)) };
    }
    default:
      return { start: iso(utc(anio, mes, 1)), end: iso(utc(anio, mes + 1, 0)) };
  }
}

const MESES_POR_PRESET: Record<PresetDePeriodo, number> = {
  month: 1,
  quarter: 3,
  year: 12,
  last3: 3,
  last6: 6,
  last12: 12,
  custom: 0,
};

export const moverAncla = (ancla: string, preset: PresetDePeriodo, paso: -1 | 1): string =>
  addMonthsToIso(ancla, paso * MESES_POR_PRESET[preset]);
