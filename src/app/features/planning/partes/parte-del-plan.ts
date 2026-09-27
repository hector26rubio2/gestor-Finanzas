import { inject } from '@angular/core';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state';
import { SimuladorDePlanificacion } from '@features/planning/simulador';

export abstract class ParteDelPlan {
  readonly i18n = inject(I18nService);
  readonly sim = inject(SimuladorDePlanificacion);
  private readonly store = inject(AppStore);

  money(valor: number): string {
    return this.store.money(valor);
  }

  numero(valor: unknown): number {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? Math.max(0, convertido) : 0;
  }
}
