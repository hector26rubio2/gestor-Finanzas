import { DestroyRef, ResourceStatus, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, tap } from 'rxjs';
import { ApiWritesBus } from '@core/api/api-writes';
import { AppStore, CAPABILITIES } from './store';

export type EstadoDeRecurso = 'inactivo' | 'cargando' | 'listo' | 'error';

export interface OpcionesDeRecursoRemoto<T> {
  readonly cargar: () => Observable<T>;
  readonly permiso?: string;
  readonly dependencia?: () => string | number;
}

export interface RecursoRemoto<T> {
  readonly valor: Signal<T | undefined>;
  readonly estado: Signal<EstadoDeRecurso>;
  solicitar(destruccion?: DestroyRef): void;
  soltar(destruccion?: DestroyRef): void;
  actualizar(cambio: (valor: T) => T): void;
  recargar(): void;
}

const ESTADO_DE_RECURSO: Readonly<Record<ResourceStatus, EstadoDeRecurso>> = {
  idle: 'inactivo',
  loading: 'cargando',
  reloading: 'listo',
  resolved: 'listo',
  local: 'listo',
  error: 'error',
};

export function crearRecursoRemoto<T>(opciones: OpcionesDeRecursoRemoto<T>): RecursoRemoto<T> {
  const store = inject(AppStore);
  const capacidades = inject(CAPABILITIES);
  const escrituras = inject(ApiWritesBus);
  const usuarios = signal(0);
  const claveCargada = signal<string | null>(null);
  let obsoleto = false;
  const registrados = new WeakSet<DestroyRef>();

  const clave = computed(() => {
    if (store.remoteState() !== 'ready') return null;
    if (opciones.permiso && !capacidades.allows(opciones.permiso)) return null;
    const organizacion = store.organization()?.id;
    const usuario = store.user()?.id;
    if (!organizacion || !usuario) return null;
    return `${usuario}|${organizacion}`;
  });

  const peticion = computed(() => {
    const actual = clave();
    if (actual === null) return undefined;
    if (usuarios() === 0 && claveCargada() !== actual) return undefined;
    return `${actual}|${opciones.dependencia?.() ?? ''}`;
  });

  const recurso = rxResource<T, string | undefined>({
    params: peticion,
    stream: () => {
      const origen = clave();
      return opciones.cargar().pipe(tap(() => claveCargada.set(origen)));
    },
  });

  effect(() => {
    if (clave() === null) claveCargada.set(null);
  });

  let ultimaVersion = escrituras.version();
  effect(() => {
    const version = escrituras.version();
    untracked(() => {
      if (version === ultimaVersion) return;
      ultimaVersion = version;
      if (usuarios() > 0) recurso.reload();
      else obsoleto = true;
    });
  });

  const soltar = (destruccion: DestroyRef) => {
    if (registrados.delete(destruccion)) usuarios.update((n) => n - 1);
  };

  return {
    valor: computed(() => (recurso.hasValue() ? recurso.value() : undefined)),
    estado: computed(() => ESTADO_DE_RECURSO[recurso.status()]),
    solicitar: (destruccion = inject(DestroyRef)) => {
      if (!registrados.has(destruccion)) {
        registrados.add(destruccion);
        usuarios.update((n) => n + 1);
        destruccion.onDestroy(() => soltar(destruccion));
      }
      if (obsoleto) {
        obsoleto = false;
        recurso.reload();
      }
    },
    soltar: (destruccion = inject(DestroyRef)) => soltar(destruccion),
    actualizar: (cambio) => {
      if (recurso.hasValue()) recurso.set(cambio(recurso.value() as T) as Exclude<T, undefined>);
    },
    recargar: () => void recurso.reload(),
  };
}
