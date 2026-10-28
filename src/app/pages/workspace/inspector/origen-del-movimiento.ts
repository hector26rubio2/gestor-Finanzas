import { computed, effect, inject, signal } from '@angular/core';
import { AppStore } from '@core/state';

interface Origen {
  readonly type: 'account' | 'card';
  readonly id: string;
}

export class OrigenDelMovimiento {
  private readonly store = inject(AppStore);
  private readonly origen = signal<Origen | null>(null);

  readonly cuentaDeOrigen = computed(() => {
    const origen = this.origen();
    const inspector = this.store.inspector();
    if (!origen || inspector?.type !== 'movement') return null;
    return this.store.account(origen.id) ?? null;
  });

  private readonly olvidarAlCerrar = effect(() => {
    if (!this.store.inspector()) this.origen.set(null);
  });

  abrirMovimiento(id: string): void {
    const actual = this.store.inspector();
    this.origen.set(
      actual && (actual.type === 'account' || actual.type === 'card') ? { type: actual.type, id: actual.id } : null,
    );
    this.store.inspect('movement', id);
  }

  volver(): void {
    const origen = this.origen();
    if (!origen) return;
    this.origen.set(null);
    this.store.inspect(origen.type, origen.id);
  }
}
