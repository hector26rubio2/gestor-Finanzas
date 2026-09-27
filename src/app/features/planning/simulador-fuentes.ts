import { effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient, ApiWritesBus } from '@core/api';
import type { ApiObligation, ApiRecurrence } from '@core/api';
import { P } from '@core/session';
import { CAPABILITIES, AppStore } from '@core/state';
import type { Movement } from '@core/state';
import { I18nService } from '@core/i18n';
import { traerMovimientosDeTarjetas } from '@shared/tarjetas';

export class FuentesDelSimulador {
  private readonly store = inject(AppStore);
  private readonly i18n = inject(I18nService);
  private readonly api = inject(FinanceApiClient);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly escrituras = inject(ApiWritesBus);

  readonly obligaciones = signal<readonly ApiObligation[]>([]);
  private readonly traerObligaciones = effect(() => {
    this.escrituras.version();
    if (this.store.remoteState() !== 'ready') return;
    if (!this.capabilities.allows(P.personas.obligaciones.listar)) return;
    untracked(() => {
      void firstValueFrom(this.api.obligations())
        .then((lista) => this.obligaciones.set(lista))
        .catch(() => this.obligaciones.set([]));
    });
  });
  readonly movimientosDeTarjetas = signal<readonly Movement[] | null>(null);
  private readonly traerTarjetas = effect(() => {
    this.escrituras.version();
    if (this.store.remoteState() !== 'ready') return;
    const tarjetas = this.store
      .data()
      .accounts.filter((a) => a.type === 'credit')
      .map((a) => a.id);
    untracked(() => {
      void traerMovimientosDeTarjetas(this.api, this.i18n, this.store.kindCatalog(), tarjetas)
        .then((lista) => this.movimientosDeTarjetas.set(lista))
        .catch(() => this.movimientosDeTarjetas.set(null));
    });
  });
  readonly recurrentesApi = signal<readonly ApiRecurrence[]>([]);
  private readonly traerRecurrentes = effect(() => {
    this.escrituras.version();
    if (this.store.remoteState() !== 'ready') return;
    if (!this.capabilities.allows(P.calendario.recurrencias.listar)) return;
    untracked(() => {
      void firstValueFrom(this.api.recurrences())
        .then((lista) => this.recurrentesApi.set(lista as readonly ApiRecurrence[]))
        .catch(() => this.recurrentesApi.set([]));
    });
  });
}
