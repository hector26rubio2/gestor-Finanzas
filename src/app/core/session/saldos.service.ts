import { Injectable, effect, inject, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiWritesBus } from '@core/api/api-writes';
import { FinanceApiClient } from '@core/api/api-client';
import { AppStore } from '@core/state/store';
import { parseMoney } from '@core/utils/money';
import { todayIso } from '@core/utils/dates';

const ESPERA_MS = 300;

@Injectable({ providedIn: 'root' })
export class SaldosService {
  private readonly store = inject(AppStore);
  private readonly api = inject(FinanceApiClient);
  private readonly escrituras = inject(ApiWritesBus);
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private versionVista: number | null = null;

  constructor() {
    effect(() => {
      const version = this.escrituras.version();
      if (this.store.remoteState() !== 'ready') {
        this.versionVista = null;
        return;
      }
      if (this.versionVista === null || version === this.versionVista) {
        this.versionVista = version;
        return;
      }
      this.versionVista = version;
      untracked(() => this.programar());
    });
  }

  private programar(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      void this.refrescar();
    }, ESPERA_MS);
  }

  async refrescar(): Promise<void> {
    const hoy = todayIso();
    try {
      const tablero = await firstValueFrom(this.api.dashboard(hoy, hoy));
      const saldos = new Map<string, number>();
      for (const cuenta of tablero.accounts ?? []) saldos.set(cuenta.account.id, parseMoney(cuenta.balance));
      for (const tarjeta of tablero.cards ?? []) saldos.set(tarjeta.card.id, -parseMoney(tarjeta.debt));
      this.store.saldosDelServidor.set(saldos);
    } catch {
      this.store.saldosDelServidor.set(null);
    }
  }
}
