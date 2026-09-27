import { Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient, ApiWritesBus } from '@core/api';
import type { ApiMovement } from '@core/api';
import { I18nService } from '@core/i18n';
import { toMovement } from '@core/session';
import type { Movement } from '@core/state';
import { AppStore } from '@core/state';
import type { Rango } from './historia';

const TAMANO_DE_PAGINA = 100;
const PAGINAS_MAXIMAS = 40;

export interface MovimientosDelPeriodo {
  readonly movimientos: Signal<readonly Movement[]>;
  readonly cargando: Signal<boolean>;
  readonly completos: Signal<boolean>;
}

export function crearMovimientosDelPeriodo(rango: Signal<Rango | null>): MovimientosDelPeriodo {
  const store = inject(AppStore);
  const api = inject(FinanceApiClient);
  const i18n = inject(I18nService);
  const escrituras = inject(ApiWritesBus);
  const remotos = signal<{ clave: string; movs: readonly ApiMovement[]; completos: boolean } | null>(null);
  const cargando = signal(false);
  let pedido = 0;

  effect(() => {
    const actual = rango();
    escrituras.version();
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

  const movimientos = computed<readonly Movement[]>(() => {
    const actual = rango();
    if (!actual) return [];
    const servidor = remotos();
    if (servidor?.clave === `${actual.start}|${actual.end}`) {
      const catalogo = store.kindCatalog();
      return servidor.movs.map((m) => toMovement(i18n, catalogo, m));
    }
    return store.data().movements.filter((m) => m.date >= actual.start && m.date <= actual.end);
  });

  return {
    movimientos,
    cargando: cargando.asReadonly(),
    completos: computed(() => (remotos()?.completos ?? false)),
  };
}

async function traerTodos(api: FinanceApiClient, rango: Rango): Promise<{ movs: ApiMovement[]; completos: boolean }> {
  const movs: ApiMovement[] = [];
  for (let pagina = 1; pagina <= PAGINAS_MAXIMAS; pagina++) {
    const respuesta = await firstValueFrom(
      api.movements({
        page: pagina,
        pageSize: TAMANO_DE_PAGINA,
        filter: { range: { start: rango.start, end: rango.end } },
      }),
    );
    movs.push(...respuesta.items);
    if (!respuesta.hasNext) return { movs, completos: true };
  }
  return { movs, completos: false };
}
