import { effect, inject, signal, untracked } from '@angular/core';
import { ApiWritesBus } from '@core/api';
import type { ApiInvestmentOperation, ApiValuation } from '@core/api';
import { CatalogCommands } from '@core/state';

export class InspectorInversion {
  private readonly comandos = inject(CatalogCommands);
  private readonly escrituras = inject(ApiWritesBus);

  constructor(private readonly inversion: () => string | undefined) {}

  readonly operaciones = signal<readonly ApiInvestmentOperation[] | null>(null);
  readonly valorizaciones = signal<readonly ApiValuation[] | null>(null);
  readonly fallo = signal(false);

  private readonly traer = effect(() => {
    const id = this.inversion();
    this.escrituras.version();
    untracked(() => {
      void this.cargar(id);
    });
  });

  private async cargar(id: string | undefined): Promise<void> {
    this.operaciones.set(null);
    this.valorizaciones.set(null);
    this.fallo.set(false);
    if (!id) return;
    const [operaciones, valorizaciones] = await Promise.allSettled([
      this.comandos.investmentOperations(id),
      this.comandos.investmentValuations(id),
    ]);
    if (this.inversion() !== id) return;
    if (operaciones.status === 'fulfilled') this.operaciones.set(operaciones.value);
    if (valorizaciones.status === 'fulfilled') this.valorizaciones.set(valorizaciones.value);
    this.fallo.set(operaciones.status === 'rejected' || valorizaciones.status === 'rejected');
  }
}
