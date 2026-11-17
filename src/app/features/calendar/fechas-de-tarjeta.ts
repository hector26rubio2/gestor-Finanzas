import type { RangoDeFechas } from './periodos';
import { enRango } from './periodos';

export interface TarjetaConDias {
  id: string;
  name: string;
  cutDay?: number;
  dueDay?: number;
}

export interface FechaDeTarjeta {
  tipo: 'corte' | 'pago';
  tarjetaId: string;
  nombre: string;
}

const MESES_DEL_ANIO = 12;

function diaDelMes(anio: number, mes: number, dia: number): string {
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(dia, ultimo))).toISOString().slice(0, 10);
}

function mesesDe(rango: RangoDeFechas): { anio: number; mes: number }[] {
  const [anioInicial, mesInicial] = rango.desde.split('-').map(Number);
  const [anioFinal, mesFinal] = rango.hasta.split('-').map(Number);
  const primero = anioInicial * MESES_DEL_ANIO + (mesInicial - 1);
  const ultimo = anioFinal * MESES_DEL_ANIO + (mesFinal - 1);
  return Array.from({ length: ultimo - primero + 1 }, (_, indice) => ({
    anio: Math.floor((primero + indice) / MESES_DEL_ANIO),
    mes: (primero + indice) % MESES_DEL_ANIO,
  }));
}

export function fechasDeTarjeta(
  tarjetas: readonly TarjetaConDias[],
  rango: RangoDeFechas,
): Map<string, FechaDeTarjeta[]> {
  const fechas = new Map<string, FechaDeTarjeta[]>();
  const anotar = (iso: string, fecha: FechaDeTarjeta) => {
    if (enRango(iso, rango)) fechas.set(iso, [...(fechas.get(iso) ?? []), fecha]);
  };
  for (const { anio, mes } of mesesDe(rango)) {
    for (const tarjeta of tarjetas) {
      const base = { tarjetaId: tarjeta.id, nombre: tarjeta.name };
      if (tarjeta.cutDay) anotar(diaDelMes(anio, mes, tarjeta.cutDay), { tipo: 'corte', ...base });
      if (tarjeta.dueDay) anotar(diaDelMes(anio, mes, tarjeta.dueDay), { tipo: 'pago', ...base });
    }
  }
  return fechas;
}
