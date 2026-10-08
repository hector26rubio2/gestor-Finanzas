import { Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiDashboard, FinanceApiClient, ApiWritesBus } from '@core/api';
import type { Movement } from '@core/state';
import { AppStore } from '@core/state';
import { parseMoney, sumBy } from '@core/utils';
import { crearMovimientosDelPeriodo } from './movimientos-del-periodo';

export interface Rango {
  readonly start: string;
  readonly end: string;
}

export interface PuntoDeFlujo {
  readonly rango: Rango;
  readonly income: number;
  readonly expense: number;
  readonly net: number;
  readonly movs: readonly Movement[] | null;
}

export interface PuntoDeSaldo {
  readonly rango: Rango;
  readonly available: number;
  readonly debt: number;
}

export const PERIODOS_DE_HISTORIA = 8;
const VARIACION_MAXIMA_LEGIBLE = 999;

function isoDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function rangosMensuales(cantidad: number, referencia: string): Rango[] {
  const base = new Date(`${referencia}T12:00:00`);
  return Array.from({ length: cantidad }, (_, indice) => {
    const inicio = new Date(base.getFullYear(), base.getMonth() - cantidad + 1 + indice, 1, 12);
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 12);
    return { start: isoDe(inicio), end: isoDe(fin) };
  });
}

export function variacion(serie: readonly number[]): number | null {
  if (serie.length < 2) return null;
  const ultimo = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  if (!anterior) return null;
  const cambio = ((ultimo - anterior) / Math.abs(anterior)) * 100;
  return Math.abs(cambio) > VARIACION_MAXIMA_LEGIBLE ? null : cambio;
}

function esEconomico(m: Movement): boolean {
  return !m.movementSubtype && m.kind !== 'payment';
}

function flujoLocal(rango: Rango, movs: readonly Movement[]): PuntoDeFlujo {
  const propios = movs.filter((m) => m.date >= rango.start && m.date <= rango.end);
  const economicos = propios.filter(esEconomico);
  const income = sumBy(
    economicos.filter((m) => m.kind === 'income'),
    (m) => Math.max(0, m.amount),
  );
  const expense = sumBy(
    economicos.filter((m) => m.kind === 'expense'),
    (m) => -Math.min(0, m.amount),
  );
  return { rango, income, expense, net: sumBy(propios, (m) => m.amount), movs: propios };
}

export interface OpcionesDeFlujo {
  readonly incluir?: (m: Movement) => boolean;
  readonly usarServidor?: () => boolean;
}

export function crearHistoriaDeFlujo(rangos: Signal<readonly Rango[]>, opciones: OpcionesDeFlujo = {}) {
  const store = inject(AppStore);
  const api = inject(FinanceApiClient);
  const escrituras = inject(ApiWritesBus);
  const remota = signal<{ desde: string; hasta: string; puntos: ApiDashboard['series'] } | null>(null);
  const rangoLocal = computed<Rango | null>(() => {
    const lista = rangos();
    const conServidor = opciones.usarServidor?.() ?? true;
    return conServidor || !lista.length ? null : { start: lista[0].start, end: lista[lista.length - 1].end };
  });
  const locales = crearMovimientosDelPeriodo(rangoLocal);

  effect(() => {
    const lista = rangos();
    escrituras.version();
    if (store.remoteState() !== 'ready' || !lista.length) return;
    const desde = lista[0].start;
    const hasta = lista[lista.length - 1].end;
    untracked(() => {
      void firstValueFrom(api.dashboard(desde, hasta))
        .then((valor) => remota.set({ desde, hasta, puntos: valor.series ?? [] }))
        .catch(() => remota.set(null));
    });
  });

  return computed<readonly PuntoDeFlujo[]>(() => {
    const lista = rangos();
    const servidor = remota();
    const conServidor = opciones.usarServidor?.() ?? true;
    if (
      conServidor &&
      servidor &&
      servidor.desde === lista[0]?.start &&
      servidor.hasta === lista[lista.length - 1]?.end
    )
      return lista.map((rango) => {
        const puntos = servidor.puntos.filter((p) => p.date >= rango.start && p.date <= rango.end);
        const income = sumBy(puntos, (p) => parseMoney(p.income));
        const expense = sumBy(puntos, (p) => parseMoney(p.expense));
        return { rango, income, expense, net: income - expense, movs: null };
      });
    const incluir = opciones.incluir ?? (() => true);
    const movs = locales.movimientos().filter(incluir);
    return lista.map((rango) => flujoLocal(rango, movs));
  });
}

export function crearHistoriaDeSaldos(rangos: Signal<readonly Rango[]>) {
  const store = inject(AppStore);
  const api = inject(FinanceApiClient);
  const escrituras = inject(ApiWritesBus);
  const remota = signal<{ clave: string; puntos: PuntoDeSaldo[] } | null>(null);
  const claveDe = (lista: readonly Rango[]) => lista.map((rango) => rango.end).join('|');

  effect(() => {
    const lista = rangos();
    escrituras.version();
    if (store.remoteState() !== 'ready' || !lista.length) return;
    const clave = claveDe(lista);
    untracked(() => {
      void Promise.all(lista.map((rango) => firstValueFrom(api.dashboard(rango.start, rango.end))))
        .then((tableros) =>
          remota.set({
            clave,
            puntos: tableros.map((tablero, indice) => ({
              rango: lista[indice],
              available: sumBy(tablero.accounts ?? [], (cuenta) => parseMoney(cuenta.balance)),
              debt: sumBy(tablero.cards ?? [], (tarjeta) => parseMoney(tarjeta.debt)),
            })),
          }),
        )
        .catch(() => remota.set(null));
    });
  });

  return computed<readonly PuntoDeSaldo[]>(() => {
    const lista = rangos();
    const servidor = remota();
    return servidor?.clave === claveDe(lista) ? servidor.puntos : [];
  });
}
