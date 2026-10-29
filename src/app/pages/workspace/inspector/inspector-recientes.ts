import { effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiWritesBus, FinanceApiClient } from '@core/api';
import { I18nService } from '@core/i18n';
import { toMovement } from '@core/session';
import type { Account, Movement } from '@core/state';
import { AppStore } from '@core/state';

export const CANTIDAD_DE_RECIENTES = 8;

export class InspectorRecientes {
  private readonly api = inject(FinanceApiClient);
  private readonly i18n = inject(I18nService);
  private readonly store = inject(AppStore);
  private readonly escrituras = inject(ApiWritesBus);

  constructor(private readonly cuenta: () => Account | undefined) {}

  readonly movimientos = signal<readonly Movement[]>([]);
  readonly cargando = signal(false);

  private readonly traer = effect(() => {
    const cuenta = this.cuenta();
    this.escrituras.version();
    if (!cuenta) {
      this.movimientos.set([]);
      return;
    }
    untracked(() => {
      void this.cargar(cuenta);
    });
  });

  private async cargar(cuenta: Account): Promise<void> {
    this.cargando.set(true);
    try {
      const pagina = await firstValueFrom(
        this.api.movements({
          page: 1,
          pageSize: CANTIDAD_DE_RECIENTES,
          filter: cuenta.type === 'credit' ? { cards: [cuenta.id] } : { accounts: [cuenta.id] },
        }),
      );
      if (this.cuenta()?.id !== cuenta.id) return;
      const catalogo = this.store.kindCatalog();
      this.movimientos.set(pagina.items.map((item) => toMovement(this.i18n, catalogo, item)));
    } catch {
      if (this.cuenta()?.id === cuenta.id) this.movimientos.set([]);
    } finally {
      this.cargando.set(false);
    }
  }
}
