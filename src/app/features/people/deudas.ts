import type { ApiObligation } from '@core/api/obligations.api';
import { cuotaEnCurso } from '@core/session/mappers/movements.mapper';
import { parseMoney } from '@core/utils/money';
import { cuotaFija, enFraccion } from '@core/utils/tasas';

const ASIENTO = { desembolso: 1, cargo: 2, pago: 4 } as const;
const SALDADA = 2;

export interface AbonoDeDeuda {
  fecha: string;
  monto: number;
  nota: string | null;
}

export interface DeudaConPersona {
  id: string;
  personaId: string;
  persona: string;
  descripcion: string | null;
  direccion: 'owed' | 'owing';
  moneda: string;
  valor: number;
  cuota: number | null;
  cuotaActual: number | null;
  totalCuotas: number | null;
  cuotasRestantes: number | null;
  pendiente: number;
  tarjeta: string | null;
  pagos: number;
  abonos: AbonoDeDeuda[];
  saldada: boolean;
}

export interface Comportamiento {
  estado: 'alDia' | 'atrasado' | 'sinPlazo' | 'sinDeudas';
  atrasadas: number;
}

export function deudasDe(obligaciones: readonly ApiObligation[], hoy: string): DeudaConPersona[] {
  return obligaciones.map((o) => {
    const asientos = o.entries ?? [];
    const valor = asientos
      .filter((a) => a.type === ASIENTO.desembolso || a.type === ASIENTO.cargo)
      .reduce((total, a) => total + parseMoney(a.principalDelta), 0);
    const totalCuotas = o.terms?.termMonths ?? null;
    const abonos = asientos.filter((a) => a.type === ASIENTO.pago);
    return {
      id: o.id,
      personaId: o.counterparty.id,
      persona: o.counterparty.name,
      descripcion: o.description,
      direccion: o.direction === 1 ? 'owed' : 'owing',
      moneda: o.currency,
      valor,
      cuota: totalCuotas ? Math.round(cuotaFija(valor, enFraccion(o.terms?.monthlyRate ?? 0), totalCuotas)) : null,
      cuotaActual: totalCuotas ? cuotaEnCurso(o.openedOn, totalCuotas, hoy) : null,
      totalCuotas,
      cuotasRestantes: totalCuotas ? Math.max(0, totalCuotas - abonos.length) : null,
      pendiente: parseMoney(o.totalOutstanding),
      tarjeta: o.terms?.borrowedCardName ?? null,
      pagos: abonos.length,
      abonos: abonos
        .map((a) => ({ fecha: a.date, monto: Math.abs(parseMoney(a.principalDelta)), nota: a.note?.trim() || null }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
      saldada: o.status === SALDADA,
    };
  });
}

export function comportamientoDePago(deudas: readonly DeudaConPersona[]): Comportamiento {
  const abiertas = deudas.filter((d) => !d.saldada);
  if (!abiertas.length) return { estado: 'sinDeudas', atrasadas: 0 };
  const conPlazo = abiertas.filter((d) => d.totalCuotas && d.cuotaActual);
  if (!conPlazo.length) return { estado: 'sinPlazo', atrasadas: 0 };
  const atrasadas = conPlazo.reduce((total, d) => total + Math.max(0, d.cuotaActual! - 1 - d.pagos), 0);
  return atrasadas > 0 ? { estado: 'atrasado', atrasadas } : { estado: 'alDia', atrasadas: 0 };
}

export function masAtrasado(deudas: readonly DeudaConPersona[]): { persona: string; atrasadas: number } | null {
  const porPersona = new Map<string, DeudaConPersona[]>();
  for (const deuda of deudas) porPersona.set(deuda.persona, [...(porPersona.get(deuda.persona) ?? []), deuda]);
  let peor: { persona: string; atrasadas: number } | null = null;
  for (const [persona, suyas] of porPersona) {
    const { atrasadas } = comportamientoDePago(suyas);
    if (atrasadas > (peor?.atrasadas ?? 0)) peor = { persona, atrasadas };
  }
  return peor;
}
