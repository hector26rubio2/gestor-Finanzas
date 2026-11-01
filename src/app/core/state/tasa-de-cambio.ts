import { inject, Injectable, signal } from '@angular/core';
import { TrmApi } from '@core/api/trm.api';

@Injectable({ providedIn: 'root' })
export class TasaDeCambio {
  private readonly trm = inject(TrmApi);
  private pedida = false;
  readonly vigente = signal<number | null>(null);
  readonly cargando = signal(false);

  solicitar(): void {
    if (this.pedida) return;
    this.pedida = true;
    this.cargando.set(true);
    this.trm.today().subscribe((valor) => {
      this.vigente.set(valor);
      this.cargando.set(false);
    });
  }
}
