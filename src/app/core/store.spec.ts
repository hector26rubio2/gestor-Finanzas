import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DemoStore } from './store';

describe('DemoStore', () => {
  let store: DemoStore;

  beforeEach(() => {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    TestBed.resetTestingModule();
    store = TestBed.inject(DemoStore);
  });

  it('filters the ledger without mutating the fixture', () => {
    const total = store.data().movements.length;
    store.query.set('nómina');
    expect(store.movements().length).toBeGreaterThan(0);
    expect(store.movements().every((movement) => movement.description.toLowerCase().includes('nómina'))).toBe(true);
    expect(store.data().movements).toHaveLength(total);
  });

  it('creates both balanced legs for a transfer', () => {
    const before = store.data().movements.length;
    store.save({
      kind: 'transfer',
      date: '2026-08-31',
      description: 'Transferencia de prueba',
      accountId: 'savings-main',
      targetId: 'savings-goals',
      amount: 250000,
      category: 'Transferencias',
    });
    const created = store.data().movements.filter((movement) => movement.description === 'Transferencia de prueba');
    expect(store.data().movements).toHaveLength(before + 2);
    expect(created.map((movement) => movement.amount).sort((a, b) => a - b)).toEqual([-250000, 250000]);
  });

  it('preserves credit card terms entered in the shared account form', () => {
    store.createAccount('Tarjeta viajera', 'credit', 0, 'USD', 4200, { limit: 9000, cutDay: 12, dueDay: 27 });
    const account = store.data().accounts.find((item) => item.name === 'Tarjeta viajera');
    expect(account).toMatchObject({
      type: 'credit',
      currency: 'USD',
      exchangeRate: 4200,
      limit: 9000,
      cutDay: 12,
      dueDay: 27,
    });
  });

  it('rejects a transfer to the source account', async () => {
    await expect(
      store.save({
        kind: 'transfer',
        date: '2026-08-31',
        description: 'Inválida',
        accountId: 'savings-main',
        targetId: 'savings-main',
        amount: 1,
        category: 'Transferencias',
      }),
    ).rejects.toThrow('Selecciona una cuenta destino diferente.');
  });

  it('keeps management forms useful in explicit demo mode', async () => {
    await store.createPerson('Persona nueva', 'persona@example.test');
    await store.createInvestment('CDT nuevo', 'CDT', 'COP');
    await store.createCategory('Mascotas', '#087f68', '●');
    expect(store.data().people.some((person) => person.name === 'Persona nueva')).toBe(true);
    expect(store.data().investments.some((investment) => investment.name === 'CDT nuevo')).toBe(true);
    expect(store.history().some((event) => event.action.includes('Categoría Mascotas'))).toBe(true);
  });

  it('does not materialize a recurrence into the ledger while it is only a projection', async () => {
    const before = store.data().movements.length;
    await store.createRecurrence('Arriendo futuro', 1800000, 'savings-main', 3, '2026-10-01');
    expect(store.data().movements).toHaveLength(before);
    expect(store.history()[0].action).toContain('Recurrencia Arriendo futuro');
  });
});

describe('sesión demo persistida', () => {
  beforeEach(() => {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('no inicia sesión cuando no hay perfil guardado', () => {
    const store = TestBed.inject(DemoStore);
    store.restoreDemoSession();
    // Number(null) es 0 y 0 es un índice válido: sin la guarda explícita, no
    // haber iniciado sesión entraba como el primer perfil.
    expect(store.user()).toBeNull();
  });

  it('recupera el perfil elegido tras recargar', () => {
    const store = TestBed.inject(DemoStore);
    store.rememberDemoSession(1);
    store.restoreDemoSession();
    expect(store.user()).toBe(store.users[1]);
  });

  it('ignora un índice guardado fuera de rango', () => {
    const store = TestBed.inject(DemoStore);
    sessionStorage.setItem('finanzas.demo.perfil', '99');
    store.restoreDemoSession();
    expect(store.user()).toBeNull();
  });

  it('olvida el perfil al cerrar sesión', () => {
    const store = TestBed.inject(DemoStore);
    store.rememberDemoSession(0);
    store.forgetDemoSession();
    store.restoreDemoSession();
    expect(store.user()).toBeNull();
  });
});
