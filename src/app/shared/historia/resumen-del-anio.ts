import { Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { FinanceApiClient } from '@core/api';
import { I18nService } from '@core/i18n';
import { toMovement } from '@core/session';
import type { ApiMovement } from '@core/api';
import type { Movement } from '@core/state';
import { AppStore } from '@core/state';
import type { Rango } from './historia';
import { traerTodos } from './movimientos-del-periodo';

/** La agenda del calendario muestra a lo sumo 7 próximos. */
export const MAXIMO_DE_PROXIMOS = 7;

export interface ResumenDelAnio {
  /** Movimientos por mes del año visible (12 celdas de la vista anual). */
  readonly conteosPorMes: Signal<readonly number[]>;
  /** Próximos movimientos (posteriores a hoy) ya mapeados, a lo sumo MAXIMO_DE_PROXIMOS. */
  readonly proximos: Signal<readonly Movement[]>;
  readonly cargando: Signal<boolean>;
}

/**
 * Ticket 25: la vista anual acota la derivación de movimientos del calendario.
 *
 * Mantiene el MISMO alcance que la derivación previa (el fetch sigue cubriendo el
 * año entero, así los conteos de los 12 meses y la agenda son idénticos), pero la
 * derivación cara cambia de O(año) a O(ventana):
 * - los conteos se derivan de metadatos (`ApiMovement.date`), sin mapear cada
 *   movimiento con toMovement ni escribir el store con recordarMovimientos O(año);
 * - solo los próximos (a lo sumo MAXIMO_DE_PROXIMOS) se mapean y se recuerdan,
 *   que es lo único de la lista anual que la vista anual renderiza.
 *
 * `rangoAnual === null` (fuera de la vista anual) no hace fetch ni deriva nada.
 */
export function crearResumenDelAnio(rangoAnual: Signal<Rango | null>, maximoProximos = MAXIMO_DE_PROXIMOS): ResumenDelAnio {
  const store = inject(AppStore);
  const api = inject(FinanceApiClient);
  const i18n = inject(I18nService);
  const remotos = signal<{ clave: string; movs: readonly ApiMovement[]; completos: boolean } | null>(null);
  const cargando = signal(false);
  let pedido = 0;

  effect(() => {
    const actual = rangoAnual();
    if (!actual || store.remoteState() !== 'ready') return;
    const clave = `${actual.start}|${actual.end}`;
    const numero = ++pedido;
    untracked(() => {
      cargando.set(true);
      void traerTodos(api, actual)
        .then(({ movs, completos }) => {
          if (numero === pedido) remotos.set({ clave, movs, completos });
        })
        .catch(() => {
          if (numero === pedido) remotos.set(null);
        })
        .finally(() => {
          if (numero === pedido) cargando.set(false);
        });
    });
  });

  const conteosPorMes = computed<readonly number[]>(() => {
    const actual = rangoAnual();
    if (!actual) return [];
    const anio = actual.start.slice(0, 4);
    const servidor = remotos();
    const fechas: readonly string[] =
      servidor?.clave === `${actual.start}|${actual.end}`
        ? servidor.movs.map((m) => m.date) // metadatos: O(año de fechas, sin mapear movimientos)
        : store
            .data()
            .movements.filter((m) => m.date >= actual.start && m.date <= actual.end)
            .map((m) => m.date);
    return contarPorMes(fechas, anio);
  });

  const proximos = computed<readonly Movement[]>(() => {
    const actual = rangoAnual();
    if (!actual) return [];
    const hoy = store.hoy();
    const servidor = remotos();
    const posteriores = () => servidor?.clave === `${actual.start}|${actual.end}`;
    if (posteriores()) {
      const catalogo = store.kindCatalog();
      return servidor!.movs
        .filter((m) => m.date > hoy) // O(ventana de futuros), el orden original de páginas se conserva
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, maximoProximos)
        .map((m) => toMovement(i18n, catalogo, m)); // solo lo que la vista anual renderiza
    }
    return store
      .data()
      .movements.filter((m) => m.date >= actual.start && m.date <= actual.end && m.date > hoy)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, maximoProximos);
  });

  effect(() => {
    const cargados = proximos();
    untracked(() => store.recordarMovimientos(cargados));
  });

  return { conteosPorMes, proximos, cargando: cargando.asReadonly() };
}

/** Pase O(fechas) por prefijo, sin derivar movimientos completos. */
function contarPorMes(fechas: readonly string[], anio: string): number[] {
  const conteos = new Array(12).fill(0) as number[];
  for (const fecha of fechas) {
    if (fecha.slice(0, 4) !== anio) continue;
    const mes = Number(fecha.slice(5, 7)) - 1;
    if (mes >= 0 && mes <= 11) conteos[mes]++;
  }
  return conteos;
}
