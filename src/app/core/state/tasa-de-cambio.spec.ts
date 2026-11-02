import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TrmApi } from '@core/api/trm.api';
import { TasaDeCambio } from './tasa-de-cambio';

describe('TasaDeCambio', () => {
  it('pide la TRM una sola vez y la deja disponible', () => {
    let pedidas = 0;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TrmApi,
          useValue: {
            today: () => {
              pedidas++;
              return of(4012.5);
            },
          },
        },
      ],
    });
    const tasa = TestBed.inject(TasaDeCambio);
    expect(tasa.vigente()).toBeNull();
    tasa.solicitar();
    tasa.solicitar();
    expect(tasa.vigente()).toBe(4012.5);
    expect(tasa.cargando()).toBe(false);
    expect(pedidas).toBe(1);
  });

  it('mientras carga lo indica y si la TRM no esta disponible queda sin valor', () => {
    const respuesta = new Subject<number | null>();
    TestBed.configureTestingModule({ providers: [{ provide: TrmApi, useValue: { today: () => respuesta } }] });
    const tasa = TestBed.inject(TasaDeCambio);
    tasa.solicitar();
    expect(tasa.cargando()).toBe(true);
    respuesta.next(null);
    expect(tasa.cargando()).toBe(false);
    expect(tasa.vigente()).toBeNull();
  });
});
