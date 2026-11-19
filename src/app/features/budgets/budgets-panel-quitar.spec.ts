import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiBudget, ApiCategory, BudgetsApi, FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { BudgetsPanelComponent } from './budgets-panel';

const categoria = (id: string, name: string): ApiCategory => ({
  id,
  name,
  type: 2,
  color: '#123456',
  icon: 'tag',
  parent: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
});

const presupuesto = (categoryId: string, amount: string): ApiBudget => ({
  id: `p-${categoryId}`,
  category: { id: categoryId, name: categoryId },
  monthlyLimit: { amount, currency: 'COP' },
  updatedAt: '2026-10-01T00:00:00Z',
  usage: { usage: { amount: '0', currency: 'COP' }, usagePercent: '0', status: 'ok' },
});

const sinMovimientos = { items: [], page: 1, size: 100, total: 0, totalPages: 0, hasNext: false };
const PERMISOS = [P.cuentas.categorias.listar, P.cuentas.categorias.editar];

async function montar(deleteBudget = vi.fn(() => of(undefined))) {
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: BudgetsApi, useValue: { budgets: vi.fn(() => of([presupuesto('c1', '1000')])), deleteBudget } },
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
      { provide: FinanceApiClient, useValue: { movements: vi.fn(() => of(sinMovimientos)) } },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: PERMISOS });
  store.categories.set([categoria('c1', 'Mercado'), categoria('c2', 'Ocio')]);
  store.remoteState.set('ready');
  const fixture = TestBed.createComponent(BudgetsPanelComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;
  const fila = (nombre: string) => raiz.querySelector<HTMLElement>(`li[data-categoria="${nombre}"]`);
  return { fixture, componente: fixture.componentInstance, store, deleteBudget, fila };
}

describe('presupuestos: quitar un límite', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('solo ofrece quitar donde hay un límite puesto', async () => {
    const { fila } = await montar();

    expect(fila('Mercado')?.querySelectorAll('button')).toHaveLength(2);
    expect(fila('Ocio')?.querySelectorAll('button')).toHaveLength(1);
  });

  it('pulsar el basurero pide confirmación y todavía no borra', async () => {
    const { fixture, componente, deleteBudget, fila } = await montar();

    fila('Mercado')?.querySelectorAll<HTMLButtonElement>('button')[1].click();
    fixture.detectChanges();

    expect(componente.porQuitar()?.categoria.name).toBe('Mercado');
    expect(deleteBudget).not.toHaveBeenCalled();
  });

  it('confirmar borra el límite de esa categoría, quita su avance y avisa', async () => {
    const { fixture, componente, store, deleteBudget, fila } = await montar();
    const mercado = fila('Mercado')!;
    expect(mercado.querySelector('[role=progressbar]')).not.toBeNull();
    componente.porQuitar.set(componente.filas().find((f) => f.categoria.name === 'Mercado')!);

    await componente.quitar();
    fixture.detectChanges();

    expect(deleteBudget).toHaveBeenCalledWith('c1');
    expect(fila('Mercado')?.querySelector('[role=progressbar]')).toBeNull();
    expect(componente.porQuitar()).toBeNull();
    expect(store.toast.texto()).toContain('Mercado');
  });

  it('descartar la confirmación no borra nada', async () => {
    const { componente, deleteBudget } = await montar();
    componente.porQuitar.set(componente.filas()[0]);

    componente.porQuitar.set(null);
    await componente.quitar();

    expect(deleteBudget).not.toHaveBeenCalled();
  });

  it('si el servidor falla conserva el límite y no avisa de éxito', async () => {
    const { fixture, componente, store, fila } = await montar(
      vi.fn(() => throwError(() => new Error('No se pudo borrar'))),
    );
    componente.porQuitar.set(componente.filas().find((f) => f.categoria.name === 'Mercado')!);

    await componente.quitar();
    fixture.detectChanges();

    expect(fila('Mercado')?.querySelector('[role=progressbar]')).not.toBeNull();
    expect(store.toast.texto()).not.toContain('Mercado');
  });
});
