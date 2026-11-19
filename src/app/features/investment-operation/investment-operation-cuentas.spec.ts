import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore, type Account } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { InvestmentOperationComponent } from './investment-operation';

const cuenta = (id: string, currency: string, type: Account['type'] = 'savings'): Account => ({
  id,
  name: `Cuenta ${id}`,
  type,
  currency,
  openingBalance: 0,
});

async function abrir(monedaDeLaInversion: string) {
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(null)) } },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.patrimonio.ver, P.patrimonio.inversiones.editar] });
  datosDe({
    investments: [{ id: 'inv-1', name: 'Fondo', currency: monedaDeLaInversion } as never],
    accounts: [cuenta('cop', 'COP'), cuenta('usd', 'USD'), cuenta('usd2', 'USD'), cuenta('visa-usd', 'USD', 'credit')],
  }).aplicarEn(store);
  store.form.set({ kind: 'investment-operation', targetId: 'inv-1' });
  const fixture = TestBed.createComponent(InvestmentOperationComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('operación de inversión: las cuentas ofrecidas', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('una inversión en USD solo ofrece cuentas en USD que no sean tarjeta, más la opción sin cuenta', async () => {
    const componente = await abrir('USD');

    expect(componente.accountOptions().map((opcion) => opcion.value)).toEqual(['', 'usd', 'usd2']);
  });

  it('una inversión en pesos solo ofrece cuentas en pesos', async () => {
    const componente = await abrir('COP');

    expect(componente.accountOptions().map((opcion) => opcion.value)).toEqual(['', 'cop']);
  });

  it('la moneda del monto es la de la inversión, no la base', async () => {
    const usd = await abrir('USD');
    expect(usd.currency()).toBe('USD');

    const cop = await abrir('COP');
    expect(cop.currency()).toBe('COP');
  });
});
