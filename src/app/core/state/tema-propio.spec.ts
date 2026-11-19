import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api/api-client';
import { P } from '@core/session/permissions';
import { RUNTIME_CONFIG } from '@core/session/runtime';
import { AppStore } from './store';
import { PreferencesActions } from './preferences-actions';
import type { TemaPropio } from './theme';

const TEMA: TemaPropio = {
  name: 'Mi tema',
  primary: '#15803d',
  secondary: '#ecf5ee',
  text: '#14261a',
  surface: '#ffffff',
  border: '#d6e5da',
  background: '#f4f8f5',
  radius: 12,
};

function montar() {
  const api = { updatePreferences: vi.fn((request: { customThemeJson: string | null }) => of(request)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      { provide: FinanceApiClient, useValue: api },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({
    id: 'u1',
    name: 'Ana',
    email: 'ana@example.test',
    capabilities: [P.preferencias.editar, P.preferencias.tema.editar],
  } as never);
  return { api, store, acciones: TestBed.inject(PreferencesActions) };
}

const enviado = (api: { updatePreferences: ReturnType<typeof vi.fn> }) =>
  JSON.parse(api.updatePreferences.mock.calls.at(-1)![0].customThemeJson ?? 'null') as Record<string, unknown> | null;

describe('tema propio: crear, volver a uno de fábrica y borrar', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('crear un tema propio lo aplica, lo recuerda y lo envía guardado', () => {
    const { acciones, store, api } = montar();

    acciones.usarTemaPropio(TEMA);

    expect(store.preferences()).toMatchObject({ custom: true, customSaved: TEMA, name: 'Mi tema' });
    expect(enviado(api)).toMatchObject({ custom: true, saved: { name: 'Mi tema' } });
  });

  it('elegir un tema de fábrica conserva el propio para volver a él', () => {
    const { acciones, store } = montar();
    acciones.usarTemaPropio(TEMA);

    acciones.usarTema('light');

    expect(store.preferences().custom).toBe(false);
    expect(store.preferences().customSaved).toEqual(TEMA);
  });

  it('borrar el tema propio lo quita de las preferencias y de lo que se envía', () => {
    const { acciones, store, api } = montar();
    acciones.usarTemaPropio(TEMA);

    acciones.borrarTemaPropio();

    expect(store.preferences().customSaved).toBeUndefined();
    expect(store.preferences().custom).toBe(false);
    expect(enviado(api)).not.toHaveProperty('saved');
  });

  it('borrar el tema propio que estaba en uso vuelve a un tema de fábrica', () => {
    const { acciones, store } = montar();
    acciones.usarTemaPropio(TEMA);
    expect(store.preferences().custom).toBe(true);

    acciones.borrarTemaPropio();

    expect(['light', 'dark']).toContain(store.preferences().theme);
    expect(store.preferences().name).not.toBe('Mi tema');
  });

  it('borrar sin tema propio guardado no rompe ni cambia el tema', () => {
    const { acciones, store } = montar();
    const antes = store.preferences().theme;

    acciones.borrarTemaPropio();

    expect(store.preferences().theme).toBe(antes);
    expect(store.preferences().customSaved).toBeUndefined();
  });
});
