import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_STORE_PROVIDERS } from '@pages/admin/admin.providers';
import { AdminCommands } from '@pages/admin/stores/admin-commands';
import { AdministrationApi } from '@core/api';
import { RemoteBootstrap, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { currencyCatalog, LOCAL_CURRENCIES, setCurrencyCatalog } from '@core/utils';
import { OrganizationsTabComponent } from './organizations-tab';

describe('organizaciones: la moneda base se elige de un catálogo', () => {
  beforeEach(() => {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
        ...ADMIN_STORE_PROVIDERS,
        { provide: AdministrationApi, useValue: {} },
        { provide: RemoteBootstrap, useValue: { pollSession: vi.fn() } },
      ],
    });
  });

  afterEach(() => currencyCatalog.set(LOCAL_CURRENCIES));

  const crear = () => TestBed.createComponent(OrganizationsTabComponent).componentInstance;

  it('ofrece las monedas que publica el servidor, no un texto libre', () => {
    setCurrencyCatalog([
      { code: 'COP', minorUnits: 0 },
      { code: 'USD', minorUnits: 2 },
      { code: 'CLP', minorUnits: 0 },
    ]);

    const componente = crear();

    expect(componente.currencyOptions().map((opcion) => opcion.value)).toEqual(['COP', 'USD', 'CLP']);
  });

  it('vuelve a las monedas locales mientras el servidor no publique ninguna', () => {
    const componente = crear();

    expect(componente.currencyOptions().map((opcion) => opcion.value)).toEqual(
      LOCAL_CURRENCIES.map((moneda) => moneda.code),
    );
  });

  it('solo acepta un código ISO de tres letras', () => {
    const componente = crear();

    componente.currency.set('COP');
    expect(componente.monedaValida()).toBe(true);

    componente.currency.set('usd');
    expect(componente.monedaValida()).toBe(true);

    for (const invalida of ['', 'EU', 'EUROS', 'C0P']) {
      componente.currency.set(invalida);
      expect(componente.monedaValida(), `aceptó «${invalida}»`).toBe(false);
    }
  });

  it('no llega al backend con una moneda inválida', async () => {
    const componente = crear();
    const guardar = vi.spyOn(TestBed.inject(AdminCommands), 'crearOrganizacion').mockResolvedValue(undefined);
    componente.name.set('Espacio nuevo');
    componente.currency.set('EUROS');

    await componente.create();

    expect(guardar).not.toHaveBeenCalled();
    expect(componente.creating()).toBe(false);
    const aviso = TestBed.inject(AppStore).toast.texto();
    expect(aviso).not.toBe('');
    expect(aviso).not.toContain('admin.organizations.error.currencyInvalid');
  });

  it('envía la moneda elegida en mayúsculas, que es lo que lee el backend', async () => {
    const componente = crear();
    const guardar = vi.spyOn(TestBed.inject(AdminCommands), 'crearOrganizacion').mockResolvedValue(undefined);
    componente.name.set('Espacio nuevo');
    componente.currency.set('usd');

    await componente.create();

    expect(guardar).toHaveBeenCalledWith({ name: 'Espacio nuevo', baseCurrency: 'USD' });
    expect(componente.creating()).toBe(false);
  });
});
