import { Injectable, effect, inject, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiWritesBus } from '@core/api/api-writes';
import { FinanceApiClient } from '@core/api/api-client';
import { AppStore } from '@core/state/store';
import { mapaDesdeTablero } from '@core/saldos';
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
      this.store.saldosDelServidor.set(mapaDesdeTablero(tablero));
      this.store.saldosNoConfirmados.set(false);
    } catch {
      this.store.saldosDelServidor.set(null);
      this.store.saldosNoConfirmados.set(true);
    }
  }
}
