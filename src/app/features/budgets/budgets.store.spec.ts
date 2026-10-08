import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiBudget, BudgetsApi } from '@core/api';
import { RUNTIME_CONFIG } from '@core/session';
import { BudgetsStore } from './budgets.store';

const presupuesto = (categoryId: string, amount: string, currency = 'COP'): ApiBudget => ({
  id: `p-${categoryId}`,
  category: { id: categoryId, name: categoryId },
  monthlyLimit: { amount, currency },
  updatedAt: '2026-10-01T00:00:00Z',
});

describe('BudgetsStore', () => {
  function montar(api: Partial<Record<keyof BudgetsApi, unknown>>) {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: BudgetsApi, useValue: api },
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      ],
    });
    return TestBed.inject(BudgetsStore);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('carga una sola vez y queda listo', async () => {
    const budgets = vi.fn(() => of([presupuesto('a', '100')]));
    const store = montar({ budgets });

    expect(store.cargando()).toBe(true);
    await store.asegurarCarga();
    await store.asegurarCarga();

    expect(budgets).toHaveBeenCalledTimes(1);
    expect(store.estado()).toBe('listo');
    expect(store.items()).toHaveLength(1);
  });

  it('marca error si la carga falla y permite reintentar', async () => {
    const budgets = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValue(of([]));
    const store = montar({ budgets });

    await store.asegurarCarga();
    expect(store.estado()).toBe('error');

    await store.asegurarCarga();
    expect(store.estado()).toBe('listo');
  });

  it('fija el límite en la moneda base y reemplaza el anterior', async () => {
    const setBudget = vi.fn((_: string, limite: { amount: string; currency: string }) =>
      of(presupuesto('a', limite.amount, limite.currency)),
    );
    const store = montar({ budgets: () => of([presupuesto('a', '100'), presupuesto('b', '50')]), setBudget });
    await store.asegurarCarga();

    const guardado = await store.fijar('a', 250000);

    expect(guardado).toBe(true);
    expect(setBudget).toHaveBeenCalledWith('a', { amount: '250000', currency: 'COP' });
    expect(store.items().find((item) => item.category.id === 'a')?.monthlyLimit.amount).toBe('250000');
    expect(store.items()).toHaveLength(2);
    expect(store.guardando()).toBeNull();
  });

  it('muestra el mensaje del servidor cuando guardar falla y conserva la lista', async () => {
    const setBudget = vi.fn(() => throwError(() => new Error('La moneda no coincide.')));
    const store = montar({ budgets: () => of([presupuesto('a', '100')]), setBudget });
    await store.asegurarCarga();

    expect(await store.fijar('a', 10)).toBe(false);

    expect(store.errorDeGuardado()).toBe('La moneda no coincide.');
    expect(store.items()).toHaveLength(1);
  });

  it('quita el límite de la lista al borrarlo', async () => {
    const deleteBudget = vi.fn(() => of(undefined));
    const store = montar({ budgets: () => of([presupuesto('a', '100'), presupuesto('b', '50')]), deleteBudget });
    await store.asegurarCarga();

    expect(await store.quitar('a')).toBe(true);

    expect(deleteBudget).toHaveBeenCalledWith('a');
    expect(store.items().map((item) => item.category.id)).toEqual(['b']);
  });
});
