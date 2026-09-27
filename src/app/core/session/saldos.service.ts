import { Injectable, effect, inject, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiWritesBus, FinanceApiClient } from '@core/api';
import { AppStore } from '@core/state';
import { parseMoney, todayIso } from '@core/utils';

const ESPERA_MS = 300;

@Injectable({ providedIn: 'root' })
export class SaldosService {
  private readonly store = inject(AppStore);
  private readonly api = inject(FinanceApiClient);
  private readonly escrituras = inject(ApiWritesBus);
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.escrituras.version();
      const listo = this.store.remoteState() === 'ready';
      if (!listo) return;
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
      const tablero = await firstValueFrom(this.api.dashboard(`${hoy.slice(0, 8)}01`, hoy));
      const saldos = new Map<string, number>();
      for (const cuenta of tablero.accounts ?? []) saldos.set(cuenta.account.id, parseMoney(cuenta.balance));
      for (const tarjeta of tablero.cards ?? []) saldos.set(tarjeta.card.id, -parseMoney(tarjeta.debt));
      this.store.saldosDelServidor.set(saldos);
    } catch {
      this.store.saldosDelServidor.set(null);
    }
  }
}
