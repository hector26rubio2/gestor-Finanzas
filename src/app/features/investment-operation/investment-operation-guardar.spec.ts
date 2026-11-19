import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient, INVESTMENT_OPERATION } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore, CatalogCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { InvestmentOperationComponent } from './investment-operation';

async function abrir(capacidades: string[] = [P.patrimonio.ver, P.patrimonio.inversiones.editar]) {
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
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: capacidades });
  datosDe({
    investments: [{ id: 'inv-1', name: 'Fondo', currency: 'USD' } as never],
    accounts: [{ id: 'usd', name: 'Dólares', type: 'savings', currency: 'USD', openingBalance: 0 }],
  }).aplicarEn(store);
  store.form.set({ kind: 'investment-operation', targetId: 'inv-1' });
  const fixture = TestBed.createComponent(InvestmentOperationComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const registrar = vi
    .spyOn(TestBed.inject(CatalogCommands), 'registerInvestmentOperation')
    .mockResolvedValue(undefined);
  return { componente: fixture.componentInstance, registrar };
}

const llenar = (componente: InvestmentOperationComponent, tipo: number, extra: Record<string, unknown> = {}) =>
  componente.modelo.update((datos) => ({
    ...datos,
    type: String(tipo),
    amount: 1000,
    account: 'usd',
    quantity: 10,
    unitPrice: 100,
    ...extra,
  }));

describe('formulario de operación de inversión: lo que guarda', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('una compra envía cantidad y precio unitario en la moneda de la inversión', async () => {
    const { componente, registrar } = await abrir();
    llenar(componente, INVESTMENT_OPERATION.buy);

    await componente.save();

    expect(registrar.mock.calls[0][1]).toMatchObject({
      type: INVESTMENT_OPERATION.buy,
      amount: 1000,
      currency: 'USD',
      account: 'usd',
      quantity: 10,
      unitPrice: 100,
    });
  });

  it.each([
    ['aporte', INVESTMENT_OPERATION.contribution],
    ['retiro', INVESTMENT_OPERATION.withdrawal],
    ['dividendo', INVESTMENT_OPERATION.dividend],
    ['comisión', INVESTMENT_OPERATION.fee],
  ])('un %s no envía cantidad ni precio aunque estén escritos', async (_nombre, tipo) => {
    const { componente, registrar } = await abrir();
    llenar(componente, tipo);

    await componente.save();

    const enviado = registrar.mock.calls[0][1];
    expect(enviado.type).toBe(tipo);
    expect(enviado.quantity).toBeUndefined();
    expect(enviado.unitPrice).toBeUndefined();
  });

  it('sin cuenta elegida no envía cuenta', async () => {
    const { componente, registrar } = await abrir();
    llenar(componente, INVESTMENT_OPERATION.dividend, { account: '' });

    await componente.save();

    expect(registrar.mock.calls[0][1].account).toBeUndefined();
  });

  it('sin permiso de editar inversiones no guarda y lo dice', async () => {
    const { componente, registrar } = await abrir([P.patrimonio.ver]);
    llenar(componente, INVESTMENT_OPERATION.buy);

    await componente.save();

    expect(registrar).not.toHaveBeenCalled();
    expect(componente.error()).not.toBe('');
  });

  it('si el comando falla muestra el error y no cierra el formulario', async () => {
    const { componente, registrar } = await abrir();
    registrar.mockRejectedValueOnce(new Error('La cuenta no tiene saldo.'));
    llenar(componente, INVESTMENT_OPERATION.buy);

    await componente.save();

    expect(componente.error()).toBe('La cuenta no tiene saldo.');
  });
});
