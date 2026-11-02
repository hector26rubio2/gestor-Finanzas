import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { TransportFalso } from '@testing/transport-falso';
import { SettlementsApi } from './settlements.api';

const liquidacion = { id: 'liq-1', counterparty: { id: 'p1', name: 'Camilo' } };

function api(cuerpo: unknown) {
  TestBed.configureTestingModule({
    providers: [
      { provide: API_TRANSPORT, useValue: new TransportFalso().responder('GET /api/v1/settlements', { body: cuerpo }) },
    ],
  });
  return TestBed.inject(SettlementsApi);
}

describe('SettlementsApi.settlements', () => {
  it('desenvuelve la pagina que devuelve el servidor', async () => {
    const lista = await firstValueFrom(
      api({ items: [liquidacion], size: 1, total: 1, hasNext: false, nextCursor: null }).settlements(),
    );
    expect(lista).toEqual([liquidacion]);
  });

  it('acepta una lista directa', async () => {
    expect(await firstValueFrom(api([liquidacion]).settlements())).toEqual([liquidacion]);
  });
});
