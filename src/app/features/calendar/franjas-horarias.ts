export interface ConFechaYRegistro {
  date: string;
  registradoEl?: string;
}

export interface FranjasDelDia<T> {
  sinHora: T[];
  porHora: Map<number, T[]>;
}

const PRIMERA_HORA_DE_JORNADA = 7;
const ULTIMA_HORA_DE_JORNADA = 20;

function fechaLocalIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function horaLocalDe(movimiento: ConFechaYRegistro): number | null {
  if (!movimiento.registradoEl) return null;
  const registro = new Date(movimiento.registradoEl);
  if (Number.isNaN(registro.getTime())) return null;
  return fechaLocalIso(registro) === movimiento.date ? registro.getHours() : null;
}

export function franjasDelDia<T extends ConFechaYRegistro>(movimientos: readonly T[]): FranjasDelDia<T> {
  const franjas: FranjasDelDia<T> = { sinHora: [], porHora: new Map() };
  for (const movimiento of movimientos) {
    const hora = horaLocalDe(movimiento);
    if (hora === null) franjas.sinHora.push(movimiento);
    else franjas.porHora.set(hora, [...(franjas.porHora.get(hora) ?? []), movimiento]);
  }
  return franjas;
}

export function horasVisibles(horasConMovimientos: readonly number[]): number[] {
  const primera = Math.min(PRIMERA_HORA_DE_JORNADA, ...horasConMovimientos);
  const ultima = Math.max(ULTIMA_HORA_DE_JORNADA, ...horasConMovimientos);
  return Array.from({ length: ultima - primera + 1 }, (_, indice) => primera + indice);
}
