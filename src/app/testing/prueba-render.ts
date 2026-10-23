import { ApplicationRef, Provider, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { AppStore, SessionUser } from '@core/state';
import { ModeloDeDatos, OverridesDeDatos, datosDe } from './datos-de-prueba';
import { SesionDePrueba, sesionDe } from './sesion-de-prueba';
import { TransportFalso } from './transport-falso';

/**
 * Harness fino sobre TestBed para render rápido de componentes (tickets 02-05).
 *
 * Además del componente registra un TransportFalso en API_TRANSPORT, aplica la
 * sesión/permisos y siembra los datos del store antes del primer change detection.
 *
 * ```ts
 * const { fixture, component, store, transport } = pruebaRender(MiComponente.component, {
 *   session: sesionDe().conCapacidad('mov.editar'),
 *   data: datosDe(),
 *   providers: [provideRouter([])],
 * });
 * punctual: fixture.detectChanges() -> `cambios()`
 * ```
 */
export interface OpcionesPruebaRender {
  /** Providers extra para TestBed.configureTestingModule. */
  providers?: Provider[];
  /** Transport falso propio (con respuestas ya configuradas); si se omite se crea uno vacío y se expone en el resultado. */
  transport?: TransportFalso;
  /** SessionUser o builder fluido; se aplica en el store antes del primer detection. */
  session?: SessionUser | SesionDePrueba;
  /** Datos del store: resultado de datosDe(...) o overrides directos. */
  data?: ModeloDeDatos | OverridesDeDatos;
}

export interface ResultadoPruebaRender<TComponente> {
  fixture: ComponentFixture<TComponente>;
  component: TComponente;
  store: AppStore;
  transport: TransportFalso;
  /** detectChanges() + devuelve el fixture. */
  cambios(): ComponentFixture<TComponente>;
  /** Espera a que la app quede estable (tareas pendientes pendientes de zoneless). */
  estable(): Promise<void>;
}

export function pruebaRender<TComponente>(
  componente: Type<TComponente>,
  opciones: OpcionesPruebaRender = {},
): ResultadoPruebaRender<TComponente> {
  const transport = opciones.transport ?? new TransportFalso();
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.prueba.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [componente],
    providers: [{ provide: API_TRANSPORT, useValue: transport }, ...(opciones.providers ?? [])],
  });

  const fixture = TestBed.createComponent(componente);
  const store = TestBed.inject(AppStore);
  if (opciones.session) {
    const sesion = opciones.session instanceof SesionDePrueba ? opciones.session : sesionDe(opciones.session);
    sesion.aplicarEn(store);
  }
  if (opciones.data) {
    const datos =
      'aplicarEn' in opciones.data ? (opciones.data as ModeloDeDatos) : datosDe(opciones.data as OverridesDeDatos);
    datos.aplicarEn(store);
  }
  return {
    fixture,
    component: fixture.componentInstance,
    store,
    transport,
    cambios: () => {
      fixture.detectChanges();
      return fixture;
    },
    estable: () => TestBed.inject(ApplicationRef).whenStable(),
  };
}
