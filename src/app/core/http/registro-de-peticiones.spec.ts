import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RUNTIME_CONFIG } from '@core/session/runtime';
import {
  CODIGO_CANCELADA,
  RegistroDePeticiones,
  registroDePeticionesInterceptor,
  rutaSinValores,
} from './registro-de-peticiones';

describe('registro de peticiones', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
        provideHttpClient(withInterceptors([registroDePeticionesInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  it('guarda la ruta sin valores de la consulta', () => {
    expect(rutaSinValores('http://api.test/api/v1/dashboard?from=2026-10-01&to=2026-10-31', 'http://api.test')).toBe(
      '/api/v1/dashboard?from&to',
    );
  });

  it('anota el estado, el código del problema y la acción de cada petición al API', () => {
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    http
      .get('http://api.test/api/v1/cards', { headers: { 'X-Finanzas-Accion': 'accion-9' } })
      .subscribe({ error: () => undefined });
    backend
      .expectOne('http://api.test/api/v1/cards')
      .flush({ code: 'resource.not_found' }, { status: 404, statusText: 'No' });

    const [peticion] = TestBed.inject(RegistroDePeticiones).ultimas();
    expect(peticion).toMatchObject({
      method: 'GET',
      path: '/api/v1/cards',
      status: 404,
      action: 'accion-9',
      code: 'resource.not_found',
    });
  });

  it('marca como cancelada la petición que se abandona antes de responder', () => {
    const http = TestBed.inject(HttpClient);
    const suscripcion = http.get('http://api.test/api/v1/bootstrap').subscribe();
    suscripcion.unsubscribe();

    expect(TestBed.inject(RegistroDePeticiones).ultimas()[0]).toMatchObject({ status: 0, code: CODIGO_CANCELADA });
  });

  it('no registra peticiones a otros dominios', () => {
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    http.get('https://otro.example/datos').subscribe();
    backend.expectOne('https://otro.example/datos').flush({});

    expect(TestBed.inject(RegistroDePeticiones).ultimas()).toEqual([]);
  });
});
