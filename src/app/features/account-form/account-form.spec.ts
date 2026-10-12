import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { type Account, AppStore, CatalogCommands } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { AccountFormComponent } from './account-form';

async function abrirFormulario(accountType: 'credit' | 'savings', account?: Account) {
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
  store.user.set({
    ...USUARIO_DE_PRUEBA,
    capabilities: [P.cuentas.ver, P.cuentas.ahorro.crear, P.cuentas.tarjetas.crear, P.cuentas.tarjetas.editar],
  });
  store.form.set({ kind: 'account', accountType, account });
  const fixture = TestBed.createComponent(AccountFormComponent);
  if (!account) fixture.componentInstance.modelo.update((datos) => ({ ...datos, currency: 'USD' }));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { vista: document.body, fixture };
}

describe('formulario de cuenta nueva', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('una tarjeta de crédito pide cupo, no saldo inicial ni TRM de apertura', async () => {
    const { vista } = await abrirFormulario('credit');

    expect(vista.querySelector('input[name="cuenta.opening"]')).toBeNull();
    expect(vista.querySelector('input[name="cuenta.exchangeRate"]')).toBeNull();
    expect(vista.querySelector('input[name="cuenta.limit"]')).not.toBeNull();
  });

  it('una cuenta de ahorros sí pide saldo inicial', async () => {
    const { vista } = await abrirFormulario('savings');

    expect(vista.querySelector('input[name="cuenta.opening"]')).not.toBeNull();
    expect(vista.querySelector('input[name="cuenta.limit"]')).toBeNull();
    expect(vista.querySelector('fin-select[data-campo="issuerId"]')).not.toBeNull();
  });

  async function escribir(fixture: ComponentFixture<AccountFormComponent>, nombre: string, valor: string) {
    const campo = document.body.querySelector<HTMLInputElement>(`input[name="cuenta.${nombre}"]`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function enviar(fixture: ComponentFixture<AccountFormComponent>) {
    document.body.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('un nombre vacío muestra el error en el campo y no crea la cuenta', async () => {
    const { fixture } = await abrirFormulario('savings');
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount');

    await escribir(fixture, 'name', '');
    await enviar(fixture);

    expect(crear).not.toHaveBeenCalled();
    const campo = document.body.querySelector<HTMLInputElement>('input[name="cuenta.name"]')!;
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(document.body.querySelector('[role=alert]')?.textContent).toContain('Escribe un nombre.');
  });

  it('los últimos cuatro dígitos incompletos bloquean el envío', async () => {
    const { fixture } = await abrirFormulario('savings');
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount');

    await escribir(fixture, 'lastFour', '12');
    await enviar(fixture);

    expect(crear).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('deben ser cuatro números');
  });

  it('una tarjeta sin cupo no se envía y avisa en el campo del cupo', async () => {
    const { fixture } = await abrirFormulario('credit');
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount');

    await escribir(fixture, 'limit', '0');
    await enviar(fixture);

    expect(crear).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('El límite de crédito debe ser mayor a 0.');
  });

  it('con los datos completos envía el nombre escrito', async () => {
    const { fixture } = await abrirFormulario('savings');
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount').mockResolvedValue(undefined as never);

    await escribir(fixture, 'name', 'Fondo viaje');
    await escribir(fixture, 'lastFour', '4321');
    await enviar(fixture);

    expect(crear).toHaveBeenCalledOnce();
    expect(crear.mock.calls[0][0]).toBe('Fondo viaje');
    expect(crear.mock.calls[0][6]).toBe('4321');
  });

  it('al editar una tarjeta carga sus datos y guarda los cambios', async () => {
    const tarjeta: Account = {
      id: 't1',
      name: 'Visa',
      type: 'credit',
      currency: 'COP',
      openingBalance: 0,
      limit: 2000000,
      cutDay: 10,
      dueDay: 25,
      annualRate: 30,
      lastFour: '9999',
      dualCurrency: true,
      paymentPriority: [3, 1],
    };
    const { fixture } = await abrirFormulario('credit', tarjeta);
    const actualizar = vi.spyOn(TestBed.inject(CatalogCommands), 'updateAccount').mockResolvedValue(undefined);
    const componente = fixture.componentInstance;

    expect(componente.bimoneda()).toBe(true);
    expect(componente.paymentPriorityOrder().slice(0, 2)).toEqual([3, 1]);
    expect(componente.modelo()).toMatchObject({
      name: 'Visa',
      limit: 2000000,
      cutDay: 10,
      dueDay: 25,
      lastFour: '9999',
    });

    await escribir(fixture, 'name', 'Visa Oro');
    await enviar(fixture);

    expect(actualizar).toHaveBeenCalledOnce();
    expect(actualizar.mock.calls[0][1]).toMatchObject({ name: 'Visa Oro', credit: { cutDay: 10, dualCurrency: true } });
  });
});
