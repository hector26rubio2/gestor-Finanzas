import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { PreferencesTabComponent } from './preferences-tab';

type Pedido = { language: string; theme: string; font: string; density: string; customThemeJson?: string | null };

function montar(actualizar = vi.fn((pedido: Pedido) => of(pedido))) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: FinanceApiClient, useValue: { updatePreferences: actualizar } },
    ],
  });
  const componente = TestBed.runInInjectionContext(() => new PreferencesTabComponent());
  return { componente, actualizar, store: TestBed.inject(AppStore) };
}

const ultimo = (actualizar: ReturnType<typeof vi.fn>) => actualizar.mock.calls.at(-1)![0] as Pedido;

describe('Preferencias: cada opción cambia la app y se guarda', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-density');
    document.documentElement.style.removeProperty('--font');
  });
  afterEach(() => vi.restoreAllMocks());

  it('la densidad cambia en pantalla, en las preferencias y se envía a la API', () => {
    const { componente, actualizar, store } = montar();

    componente.setDensity('compact');

    expect(document.documentElement.dataset['density']).toBe('compact');
    expect(store.preferences().density).toBe('compact');
    expect(ultimo(actualizar).density).toBe('compact');
  });

  it('la fuente cambia en pantalla, en las preferencias y se envía a la API', () => {
    const { componente, actualizar, store } = montar();

    componente.setFont('Georgia, serif');

    expect(document.documentElement.style.getPropertyValue('--font')).toBe('Georgia, serif');
    expect(store.preferences().font).toBe('Georgia, serif');
    expect(ultimo(actualizar).font).toBe('Georgia, serif');
  });

  it('el idioma cambia en las preferencias y se envía a la API', async () => {
    const { componente, actualizar, store } = montar();

    await componente.setLocale('en');

    expect(store.preferences().locale).toBe('en');
    expect(ultimo(actualizar).language).toBe('en');
  });

  it('el tema se envía junto con el resto de las opciones ya elegidas', () => {
    const { componente, actualizar } = montar();
    componente.setDensity('compact');
    componente.setFont('Georgia, serif');

    componente.setTheme('light' as never);

    expect(ultimo(actualizar)).toMatchObject({ theme: 'light', density: 'compact', font: 'Georgia, serif' });
  });

  it('si no se puede guardar avisa en lugar de callar', async () => {
    const { componente, store } = montar(vi.fn(() => throwError(() => new Error('Sin conexión'))));

    componente.setDensity('compact');
    await Promise.resolve();
    await Promise.resolve();

    expect(store.toast.texto()).toBe('Sin conexión');
  });
});

describe('Preferencias: borrar el tema propio', () => {
  afterEach(() => vi.restoreAllMocks());

  const TEMA = {
    name: 'Mi tema',
    primary: '#15803d',
    secondary: '#ecf5ee',
    text: '#14261a',
    surface: '#ffffff',
    border: '#d6e5da',
    background: '#f4f8f5',
    radius: 12,
  };

  it('borrarMiTema quita el tema propio, avisa con su nombre y lo envía sin él', () => {
    const { componente, actualizar, store } = montar();
    store.preferences.update((p) => ({ ...p, customSaved: TEMA }));

    componente.borrarMiTema();

    expect(store.preferences().customSaved).toBeUndefined();
    expect(store.toast.texto()).toContain('Mi tema');
    const enviado = JSON.parse((actualizar.mock.calls.at(-1)![0] as Pedido).customThemeJson ?? 'null');
    expect(enviado === null || !('saved' in enviado)).toBe(true);
  });
});
