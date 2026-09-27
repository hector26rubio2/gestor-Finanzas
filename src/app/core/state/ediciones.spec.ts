import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api/api-client';
import { AppStore } from './store';

const terminos = {
  purchaseApr: { rate: '0.28' },
  cashAdvanceApr: { rate: '0.3' },
  internationalPurchaseApr: { rate: '0.28' },
  deferredDefaultApr: { rate: '0.28' },
  minimumPaymentRate: { rate: '0.05' },
  minimumPaymentFloor: null,
  gracePeriodDays: 20,
};

function montar(api: unknown) {
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: FinanceApiClient, useValue: api }] });
  const store = TestBed.inject(AppStore);
  store.data.update((data) => ({
    ...data,
    accounts: [
      { id: 'cuenta-1', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 0, lastFour: '1234' },
      {
        id: 'tarjeta-1',
        name: 'Visa',
        type: 'credit',
        currency: 'COP',
        openingBalance: 0,
        limit: 3000000,
        cutDay: 20,
        dueDay: 5,
      },
    ],
    people: [{ id: 'persona-1', name: 'Camilo', owed: 0, owing: 0 }],
    investments: [{ id: 'inversion-1', name: 'CDT', type: 'CDT', value: 0, cost: 0, currency: 'COP' }],
    movements: [
      {
        id: 'mov-1',
        date: '2026-09-01',
        description: 'Mercado',
        accountId: 'cuenta-1',
        category: 'Mercado',
        kind: 'expense',
        amount: -100,
        status: 'confirmed',
        person: 'Camilo',
      },
    ],
  }));
  store.categories.set([
    {
      id: 'categoria-1',
      name: 'Mercado',
      type: 2,
      color: '#0f766e',
      icon: '●',
      parent: 'padre-1',
      isActive: true,
      createdAt: '2026-09-01',
    },
  ]);
  return store;
}

describe('ediciones contra la API', () => {
  afterEach(() => {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  });

  it('actualiza la tarjeta con sus términos actuales y cierra el formulario', async () => {
    const updateCard = vi.fn(() => of({}));
    const store = montar({
      cards: () =>
        of([
          {
            id: 'tarjeta-1',
            name: 'Visa',
            currency: 'COP',
            terms: terminos,
            issuer: 'Banco',
            isActive: true,
            creditLimit: { amount: '3000000', currency: 'COP' },
            cycle: { statementDay: 20, paymentDueDay: 5 },
          },
        ]),
      updateCard,
    });
    store.form.set({ kind: 'account' });
    const tarjeta = store.data().accounts[1];

    await store.updateAccount(tarjeta, {
      name: ' Visa oro ',
      lastFour: '4321',
      credit: { limit: 5000000, cutDay: 25, dueDay: 10 },
    });

    expect(updateCard).toHaveBeenCalledWith('tarjeta-1', {
      name: 'Visa oro',
      creditLimit: { amount: '5000000', currency: 'COP' },
      cycle: { statementDay: 25, paymentDueDay: 10 },
      terms: terminos,
      issuer: 'Banco',
      lastFour: '4321',
      isActive: true,
      issuerEntity: null,
    });
    expect(store.account('tarjeta-1')).toMatchObject({ name: 'Visa oro', limit: 5000000, cutDay: 25, dueDay: 10 });
    expect(store.form()).toBeNull();
  });

  it('actualiza una cuenta sin perder si es la predeterminada ni su entidad', async () => {
    const updateAccount = vi.fn(() => of({}));
    const store = montar({
      accounts: () => of([{ id: 'cuenta-1', institution: 'Bancolombia', isDefault: true, isActive: true }]),
      updateAccount,
    });

    await store.updateAccount(store.data().accounts[0], { name: 'Ahorro principal', lastFour: '' });

    expect(updateAccount).toHaveBeenCalledWith('cuenta-1', {
      name: 'Ahorro principal',
      institution: 'Bancolombia',
      lastFour: null,
      isDefault: true,
      isActive: true,
    });
    expect(store.account('cuenta-1')?.name).toBe('Ahorro principal');
  });

  it('rechaza unos últimos dígitos que no son cuatro números', async () => {
    const updateAccount = vi.fn();
    const store = montar({ updateAccount });

    await expect(store.updateAccount(store.data().accounts[0], { name: 'Ahorros', lastFour: '12a' })).rejects.toThrow();
    expect(updateAccount).not.toHaveBeenCalled();
  });

  it('renombra la categoría conservando padre y estado, y los movimientos la siguen', async () => {
    const updateCategory = vi.fn((id: string, request: object) =>
      of({ id, type: 2, createdAt: '2026-09-01', ...request }),
    );
    const store = montar({ updateCategory });

    await store.updateCategory('categoria-1', { name: 'Supermercado', color: '#111111', icon: '🛒' });

    expect(updateCategory).toHaveBeenCalledWith('categoria-1', {
      name: 'Supermercado',
      color: '#111111',
      icon: '🛒',
      parent: 'padre-1',
      isActive: true,
    });
    expect(store.categories()[0].name).toBe('Supermercado');
    expect(store.data().movements[0].category).toBe('Supermercado');
  });

  it('edita la persona conservando alias, teléfono y notas, y renombra sus movimientos', async () => {
    const updatePerson = vi.fn(() => of({}));
    const store = montar({
      people: () =>
        of([{ id: 'persona-1', displayName: 'Camilo', alias: 'Cami', phone: '300', notes: 'primo', isActive: true }]),
      updatePerson,
    });

    await store.updatePerson('persona-1', { name: 'Camilo Rojas', email: 'camilo@example.test' });

    expect(updatePerson).toHaveBeenCalledWith('persona-1', {
      displayName: 'Camilo Rojas',
      alias: 'Cami',
      email: 'camilo@example.test',
      phone: '300',
      notes: 'primo',
      isActive: true,
    });
    expect(store.data().people[0]).toMatchObject({ name: 'Camilo Rojas', email: 'camilo@example.test' });
    expect(store.data().movements[0].person).toBe('Camilo Rojas');
  });

  it('edita la inversión conservando riesgo y símbolo', async () => {
    const updateInvestment = vi.fn(() => of({}));
    const store = montar({
      investments: () => of([{ id: 'inversion-1', risk: 3, symbol: 'CDT90', isActive: true }]),
      updateInvestment,
    });

    await store.updateInvestment('inversion-1', { name: 'CDT 90 días', instrumentType: 'Fondo' });

    expect(updateInvestment).toHaveBeenCalledWith('inversion-1', {
      name: 'CDT 90 días',
      instrumentType: 'Fondo',
      risk: 3,
      symbol: 'CDT90',
      isActive: true,
    });
    expect(store.data().investments[0]).toMatchObject({ name: 'CDT 90 días', type: 'Fondo' });
  });
});
