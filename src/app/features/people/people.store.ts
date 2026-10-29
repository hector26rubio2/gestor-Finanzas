import { DestroyRef, Injectable, computed, inject } from '@angular/core';
import { ObligationsApi, PeopleApi } from '@core/api';
import { P, conPosicionesDeDeuda } from '@core/session';
import { AppStore, crearRecursoRemoto } from '@core/state';
import { deudasDe } from './deudas';

@Injectable({ providedIn: 'root' })
export class PeopleStore {
  private readonly api = inject(PeopleApi);
  private readonly obligacionesApi = inject(ObligationsApi);
  private readonly store = inject(AppStore);

  private readonly posiciones = crearRecursoRemoto({
    permiso: P.personas.deudas.listar,
    cargar: () => this.api.debts(),
  });

  private readonly obligaciones = crearRecursoRemoto({
    permiso: P.personas.obligaciones.listar,
    cargar: () => this.obligacionesApi.obligations(),
  });

  readonly estado = this.posiciones.estado;
  readonly personas = computed(() => conPosicionesDeDeuda(this.store.data().people, this.posiciones.valor() ?? []));
  readonly deudas = computed(() => deudasDe(this.obligaciones.valor() ?? [], this.store.hoy()));

  solicitar(destruccion?: DestroyRef): void {
    this.posiciones.solicitar(destruccion);
    this.obligaciones.solicitar(destruccion);
  }

  soltar(destruccion?: DestroyRef): void {
    this.posiciones.soltar(destruccion);
    this.obligaciones.soltar(destruccion);
  }

  recargar(): void {
    this.posiciones.recargar();
    this.obligaciones.recargar();
  }
}
