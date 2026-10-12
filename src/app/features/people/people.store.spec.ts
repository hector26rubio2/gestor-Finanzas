import { ApplicationRef, DestroyRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiWritesBus, PeopleApi } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { PeopleStore } from './people.store';

const money = (amount: string) => ({ amount, currency: 'COP' });
const posicion = (id: string, receivable: string, ownDebt: string) => ({
  counterparty: { id, name: id },
  receivable: money(receivable),
  ownDebt: money(ownDebt),
  asOf: '2026-10-01',
});

const estabilizar = async () => {
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
};

describe('PeopleStore', () => {
  function montar(debts: ReturnType<typeof vi.fn>, capabilities: string[] = [P.personas.deudas.listar]) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PeopleApi, useValue: { debts } },
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      ],
    });
    const app = TestBed.inject(AppStore);
    app.user.set({ id: 'u1', name: 'Ana', email: 'ana@example.test', capabilities });
    app.organization.set({ id: 'o1', name: 'Personal' });
    app.remoteState.set('ready');
    app.data.update((data) => ({ ...data, people: [{ id: 'p1', name: 'Camilo', owed: 0, owing: 0 }] }));
    return TestBed.inject(PeopleStore);
  }

  const solicitar = (store: PeopleStore) => store.solicitar(TestBed.inject(Injector).get(DestroyRef));

  beforeEach(() => TestBed.resetTestingModule());

  it('no pide deudas hasta solicitarlas y las personas salen sin saldos', async () => {
    const debts = vi.fn(() => of([]));
    const store = montar(debts);
    await estabilizar();

    expect(debts).not.toHaveBeenCalled();
    expect(store.personas()[0]).toMatchObject({ name: 'Camilo', owed: 0, owing: 0 });
  });

  it('pide las deudas una sola vez y completa a las personas', async () => {
    const debts = vi.fn(() => of([posicion('p1', '500', '20')]));
    const store = montar(debts);

    solicitar(store);
    solicitar(store);
    await estabilizar();

    expect(debts).toHaveBeenCalledTimes(1);
    expect(store.estado()).toBe('listo');
    expect(store.personas()[0]).toMatchObject({ owed: 500, owing: 20 });
  });

  it('sin el permiso de deudas no pide nada', async () => {
    const debts = vi.fn(() => of([posicion('p1', '500', '20')]));
    const store = montar(debts, []);

    solicitar(store);
    await estabilizar();

    expect(debts).not.toHaveBeenCalled();
    expect(store.personas()[0].owed).toBe(0);
  });

  it('retirar el permiso descarta las deudas ya cargadas', async () => {
    const debts = vi.fn(() => of([posicion('p1', '500', '0')]));
    const store = montar(debts);
    solicitar(store);
    await estabilizar();
    expect(store.personas()[0].owed).toBe(500);

    TestBed.inject(AppStore).user.set({ id: 'u1', name: 'Ana', email: 'ana@example.test', capabilities: [] });
    await estabilizar();

    expect(store.personas()[0].owed).toBe(0);
  });

  it('un fallo deja el estado en error y recargar reintenta', async () => {
    const debts = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValue(of([posicion('p1', '10', '0')]));
    const store = montar(debts);

    solicitar(store);
    await estabilizar();
    expect(store.estado()).toBe('error');
    expect(store.personas()[0].owed).toBe(0);

    store.recargar();
    await estabilizar();
    expect(store.estado()).toBe('listo');
    expect(store.personas()[0].owed).toBe(10);
  });

  it('recarga tras una escritura mientras se usa', async () => {
    const debts = vi.fn(() => of([posicion('p1', '500', '0')]));
    const store = montar(debts);
    solicitar(store);
    await estabilizar();

    TestBed.inject(ApiWritesBus).notify();
    await estabilizar();

    expect(debts).toHaveBeenCalledTimes(2);
  });
});
