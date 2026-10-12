import { DestroyRef, Injectable, computed, inject } from '@angular/core';
import { PeopleApi } from '@core/api';
import { P, conPosicionesDeDeuda } from '@core/session';
import { AppStore, crearRecursoRemoto } from '@core/state';

@Injectable({ providedIn: 'root' })
export class PeopleStore {
  private readonly api = inject(PeopleApi);
  private readonly store = inject(AppStore);

  private readonly deudas = crearRecursoRemoto({
    permiso: P.personas.deudas.listar,
    cargar: () => this.api.debts(),
  });

  readonly estado = this.deudas.estado;
  readonly personas = computed(() => conPosicionesDeDeuda(this.store.data().people, this.deudas.valor() ?? []));

  solicitar(destruccion?: DestroyRef): void {
    this.deudas.solicitar(destruccion);
  }

  soltar(destruccion?: DestroyRef): void {
    this.deudas.soltar(destruccion);
  }

  recargar(): void {
    this.deudas.recargar();
  }
}
