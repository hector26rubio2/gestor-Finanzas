import { MovementKind } from '@core/utils/movement-kinds';

export interface EventoPrevisto {
  fecha: string;
  monto: number;
}

export interface DatosDeProyeccion {
  hoy: string;
  disponibleHoy: number;
  eventos: readonly EventoPrevisto[];
  dias: readonly string[];
}

const MAXIMO_DE_DIAS_DE_PROYECCION = 732;
const MILISEGUNDOS_POR_DIA = 86_400_000;

export function inicioDeLaProyeccion(hoy: string, inicioVisible: string, fin: string): string {
  if (hoy >= inicioVisible) return inicioVisible;
  const dias = (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / MILISEGUNDOS_POR_DIA;
  return dias <= MAXIMO_DE_DIAS_DE_PROYECCION ? hoy : inicioVisible;
}

export function efectoEnElDisponible(clase: number | null, monto: number): number {
  if (clase === MovementKind.income) return monto;
  if (clase === MovementKind.expense) return -monto;
  return 0;
}

export function saldosProyectados({ hoy, disponibleHoy, eventos, dias }: DatosDeProyeccion): Map<string, number> {
  const futuros = eventos.filter((evento) => evento.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const saldos = new Map<string, number>();
  let saldo = disponibleHoy;
  let siguiente = 0;
  for (const dia of [...dias].sort()) {
    if (dia < hoy) continue;
    while (siguiente < futuros.length && futuros[siguiente].fecha <= dia) {
      saldo += futuros[siguiente].monto;
      siguiente += 1;
    }
    saldos.set(dia, saldo);
  }
  return saldos;
}
