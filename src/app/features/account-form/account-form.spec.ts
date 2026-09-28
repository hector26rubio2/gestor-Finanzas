import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { AccountFormComponent } from './account-form';

async function abrirFormulario(accountType: 'credit' | 'savings') {
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
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.cuentas.ver] });
  store.form.set({ kind: 'account', accountType });
  const fixture = TestBed.createComponent(AccountFormComponent);
  fixture.componentInstance.currency = 'USD';
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return document.body;
}

describe('formulario de cuenta nueva', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('una tarjeta de crédito pide cupo, no saldo inicial ni TRM de apertura', async () => {
    const vista = await abrirFormulario('credit');

    expect(vista.querySelector('input[name="opening"]')).toBeNull();
    expect(vista.querySelector('input[name="exchangeRate"]')).toBeNull();
    expect(vista.querySelector('input[name="limit"]')).not.toBeNull();
  });

  it('una cuenta de ahorros sí pide saldo inicial', async () => {
    const vista = await abrirFormulario('savings');

    expect(vista.querySelector('input[name="opening"]')).not.toBeNull();
    expect(vista.querySelector('input[name="limit"]')).toBeNull();
    expect(vista.querySelector('fin-select[name="issuerId"]')).not.toBeNull();
  });
});
