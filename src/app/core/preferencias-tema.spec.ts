import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from './api-client';
import { P } from './permissions';
import { RUNTIME_CONFIG } from './runtime';
import { DemoStore } from './store';

describe('persistPreferences', () => {
  const usuario = (permisos: readonly string[]) => ({
    id: 'u1',
    name: 'Lectora',
    email: 'lectora@example.test',
    role: 'Colaboradora',
    org: 'Personal',
    capabilities: [...permisos],
  });

  const montar = () => {
    const api = { updatePreferences: vi.fn((request: { customThemeJson: string | null }) => of(request)) };
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });
    return { api, store: TestBed.inject(DemoStore) };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('no manda la paleta propia cuando la sesión no puede definirla', async () => {
    // La API responde 403 a cualquier tema personalizado de quien no gobierna la
    // organización. Enviarlo siempre convertía un cambio de preset, de idioma o de
    // tipografía en un error, que es el fallo que se reportó.
    const { api, store } = montar();
    store.user.set(usuario([P.preferencias.ver, P.preferencias.editar]) as never);

    await store.persistPreferences();

    expect(api.updatePreferences).toHaveBeenCalledOnce();
    expect(api.updatePreferences.mock.calls[0][0]).toMatchObject({ customThemeJson: null });
  });

  it('manda la paleta propia cuando la sesión puede definirla', async () => {
    const { api, store } = montar();
    store.user.set(usuario([P.preferencias.ver, P.preferencias.editar, P.preferencias.tema.editar]) as never);

    await store.persistPreferences();

    const enviado = api.updatePreferences.mock.calls[0][0];
    expect(enviado.customThemeJson).toBeTypeOf('string');
    expect(JSON.parse(enviado.customThemeJson!)).toMatchObject({ accent: store.preferences().accent });
  });
});
