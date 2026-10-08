import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiBudget, ApiCategory, BudgetsApi, FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { BudgetsPanelComponent } from './budgets-panel';

const categoria = (id: string, name: string, cambios: Partial<ApiCategory> = {}): ApiCategory => ({
  id,
  name,
  type: 2,
  color: '#123456',
  icon: 'tag',
  parent: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  ...cambios,
});

const presupuesto = (categoryId: string, amount: string, currency = 'COP'): ApiBudget => ({
  id: `p-${categoryId}`,
  category: { id: categoryId, name: categoryId },
  monthlyLimit: { amount, currency },
  updatedAt: '2026-10-01T00:00:00Z',
});

describe('BudgetsPanelComponent', () => {
  const sinMovimientos = { items: [], page: 1, size: 100, total: 0, totalPages: 0, hasNext: false };

  async function montar(
    permisos: string[],
    presupuestos: ApiBudget[],
    api: Partial<Record<keyof BudgetsApi, unknown>> = {},
  ) {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
    TestBed.resetTestingModule();
    const budgetsApi = { budgets: vi.fn(() => of(presupuestos)), ...api };
    TestBed.configureTestingModule({
      providers: [
        { provide: BudgetsApi, useValue: budgetsApi },
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: { movements: vi.fn(() => of(sinMovimientos)) } },
      ],
    });
    const store = TestBed.inject(AppStore);
    store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: permisos });
    store.categories.set([categoria('c1', 'Mercado'), categoria('c2', 'Ocio'), categoria('c3', 'Sueldo', { type: 1 })]);
    store.remoteState.set('ready');
    const fixture = TestBed.createComponent(BudgetsPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, budgetsApi, raiz: fixture.nativeElement as HTMLElement };
  }

  const fila = (raiz: HTMLElement, nombre: string) => raiz.querySelector<HTMLElement>(`li[data-categoria="${nombre}"]`);

  beforeEach(() => TestBed.resetTestingModule());

  it('muestra una fila por categoría de gasto con su límite y avance', async () => {
    const { raiz } = await montar(
      [P.cuentas.categorias.listar, P.cuentas.categorias.editar],
      [presupuesto('c1', '1000')],
    );

    expect(raiz.querySelectorAll('li[data-categoria]')).toHaveLength(2);
    expect(fila(raiz, 'Mercado')?.querySelector('[role=progressbar]')).not.toBeNull();
    expect(fila(raiz, 'Ocio')?.querySelector('[role=progressbar]')).toBeNull();
    expect(fila(raiz, 'Sueldo')).toBeNull();
  });

  it('un usuario de solo lectura ve los datos sin botones de edición', async () => {
    const { raiz } = await montar([P.cuentas.categorias.listar], [presupuesto('c1', '1000')]);

    expect(raiz.querySelector('[data-slot=solo-lectura]')).not.toBeNull();
    expect(raiz.querySelectorAll('li[data-categoria] button')).toHaveLength(0);
  });

  it('edita el límite y lo guarda en la moneda base', async () => {
    const setBudget = vi.fn((categoryId: string, limite: { amount: string; currency: string }) =>
      of(presupuesto(categoryId, limite.amount, limite.currency)),
    );
    const { fixture, raiz } = await montar([P.cuentas.categorias.listar, P.cuentas.categorias.editar], [], {
      setBudget,
    });

    fila(raiz, 'Ocio')?.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    const campo = raiz.querySelector<HTMLInputElement>('input[data-slot=limite]');
    expect(campo).not.toBeNull();
    campo!.value = '300000';
    campo!.dispatchEvent(new Event('input'));
    raiz.querySelector<HTMLButtonElement>('button[type=submit]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setBudget).toHaveBeenCalledWith('c2', { amount: '300000', currency: 'COP' });
    expect(fila(raiz, 'Ocio')?.querySelector('[role=progressbar]')).not.toBeNull();
  });

  it('rechaza un límite vacío o en cero sin llamar al servidor', async () => {
    const setBudget = vi.fn();
    const { fixture, raiz } = await montar([P.cuentas.categorias.listar, P.cuentas.categorias.editar], [], {
      setBudget,
    });

    fila(raiz, 'Ocio')?.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    const campo = raiz.querySelector<HTMLInputElement>('input[data-slot=limite]')!;
    campo.value = '0';
    campo.dispatchEvent(new Event('input'));
    raiz.querySelector<HTMLButtonElement>('button[type=submit]')?.click();
    fixture.detectChanges();

    expect(setBudget).not.toHaveBeenCalled();
    expect(raiz.querySelector('[role=alert]')?.textContent).toContain('mayor que cero');
  });

  it('avisa cuando un límite está en otra moneda y no mide el avance', async () => {
    const { raiz } = await montar([P.cuentas.categorias.listar], [presupuesto('c1', '100', 'USD')]);

    expect(fila(raiz, 'Mercado')?.querySelector('[role=progressbar]')).toBeNull();
    expect(fila(raiz, 'Mercado')?.querySelector('[role=status]')?.textContent).toContain('USD');
  });
});
