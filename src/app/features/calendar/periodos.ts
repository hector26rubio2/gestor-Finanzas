export type VistaDeCalendario = 'day' | 'week' | 'month' | 'year';

export interface RangoDeFechas {
  desde: string;
  hasta: string;
}

const DIAS_DE_LA_SEMANA = 7;

function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function masDias(fecha: Date, dias: number): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate() + dias));
}

function mesCompleto(anio: number, mes: number): RangoDeFechas {
  return { desde: aIso(new Date(Date.UTC(anio, mes, 1))), hasta: aIso(new Date(Date.UTC(anio, mes + 1, 0))) };
}

function anioCompleto(anio: number): RangoDeFechas {
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
}

export function rangoVisible(vista: VistaDeCalendario, seleccionada: string): RangoDeFechas {
  const fecha = aFecha(seleccionada);
  if (vista === 'day') return { desde: seleccionada, hasta: seleccionada };
  if (vista === 'week') {
    const lunes = masDias(fecha, -((fecha.getUTCDay() + 6) % DIAS_DE_LA_SEMANA));
    return { desde: aIso(lunes), hasta: aIso(masDias(lunes, DIAS_DE_LA_SEMANA - 1)) };
  }
  if (vista === 'month') return mesCompleto(fecha.getUTCFullYear(), fecha.getUTCMonth());
  return anioCompleto(fecha.getUTCFullYear());
}

export function rangoSiguiente(vista: VistaDeCalendario, seleccionada: string): RangoDeFechas {
  const visible = rangoVisible(vista, seleccionada);
  const siguiente = masDias(aFecha(visible.hasta), 1);
  return rangoVisible(vista, aIso(siguiente));
}

export function enRango(iso: string, rango: RangoDeFechas): boolean {
  return iso >= rango.desde && iso <= rango.hasta;
}
