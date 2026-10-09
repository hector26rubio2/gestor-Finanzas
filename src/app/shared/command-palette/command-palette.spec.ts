import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNTIME_CONFIG, P } from '@core/session';
import { AppStore, navigation } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { CommandPaletteComponent } from './command-palette';
import { CommandPaletteService } from './command-palette.service';

describe('paleta de comandos', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'dashboard', children: [] },
          { path: 'movements', children: [] },
        ]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      ],
    });
    const store = TestBed.inject(AppStore);
    store.featureFlags.set(Object.fromEntries(navigation.map((entrada) => [entrada.path, true])));
    store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.dashboard.ver, P.movimientos.ver] });
  });

  afterEach(() => vi.restoreAllMocks());

  it('Enter elige el comando filtrado sin emitir sobre elementos destruidos', async () => {
    const advertencias = vi.spyOn(console, 'warn');
    const fixture = TestBed.createComponent(CommandPaletteComponent);
    const servicio = TestBed.inject(CommandPaletteService);
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate');
    servicio.abrir();
    fixture.detectChanges();
    await fixture.whenStable();

    const entrada = document.querySelector<HTMLInputElement>('input[role=combobox]');
    expect(entrada).not.toBeNull();
    entrada!.value = 'movim';
    entrada!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    entrada!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navegar).toHaveBeenCalledTimes(1);
    expect(servicio.abierto()).toBe(false);
    const mensajes = advertencias.mock.calls.map((llamada) => String(llamada[0]));
    expect(mensajes.some((mensaje) => mensaje.includes('NG0953'))).toBe(false);
  });
});
