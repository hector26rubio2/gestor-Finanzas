import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetsApi, FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import type { Movement } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import type { DatosDelTablero } from '../dashboard-datos';
import { DashboardPeriodo } from '../periodo/dashboard-periodo';
import { ResumenComponent } from './resumen';

const punto = (income: number, expense: number) => ({
  rango: { start: '2026-09-01', end: '2026-09-30' },
  income,
  expense,
  net: income - expense,
  movs: null,
});

function datosDeLaPantalla(cambios: Record<string, unknown> = {}): DatosDelTablero {
  return {
    income: signal(1200),
    expense: signal(600),
    net: signal(600),
    historial: signal([punto(1000, 500), punto(1200, 600)]),
    historialAnual: signal([punto(800, 800)]),
    timeline: signal([
      { key: '2026-10-02', label: '02 oct', income: 1200, expense: 100 },
      { key: '2026-10-15', label: '15 oct', income: 0, expense: 500 },
    ]),
    movements: signal<readonly Movement[]>([]),
    categoryDistribution: signal([]),
    globalCategory: signal('all'),
    cargandoPeriodo: signal(false),
    alternarCategoria: vi.fn(),
    ...cambios,
  } as unknown as DatosDelTablero;
}

describe('ResumenComponent', () => {
  const sinMovimientos = { items: [], page: 1, size: 100, total: 0, totalPages: 0, hasNext: false };

  function montar(permisos: string[], datos: DatosDelTablero = datosDeLaPantalla()) {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } },
        DashboardPeriodo,
        { provide: BudgetsApi, useValue: { budgets: vi.fn(() => of([])) } },
        { provide: FinanceApiClient, useValue: { movements: vi.fn(() => of(sinMovimientos)) } },
      ],
    });
    const store = TestBed.inject(AppStore);
    store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: permisos });
    const fixture = TestBed.createComponent(ResumenComponent);
    fixture.componentRef.setInput('datos', datos);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('calcula la variación contra el periodo anterior y contra el año anterior', () => {
    const { fixture } = montar([P.dashboard.kpi.ingresos, P.dashboard.kpi.gastos, P.dashboard.kpi.balance]);
    const resumen = fixture.componentInstance;

    expect(resumen.cambioDeIngresos()).toBeCloseTo(20);
    expect(resumen.cambioDeGastos()).toBeCloseTo(20);
    expect(resumen.tasaDeAhorro()).toBe(50);
    const filas = resumen.variaciones();
    expect(filas.map((fila) => fila.clave)).toEqual(['income', 'expense', 'net']);
    expect(filas[0].contraAnio).toBeCloseTo(50);
    expect(filas[1].contraAnio).toBeCloseTo(-25);
  });

  it('solo muestra las secciones que los permisos permiten', () => {
    const sinPermisos = montar([]);
    expect(sinPermisos.raiz.querySelector('fin-kpi')).toBeNull();
    expect(sinPermisos.raiz.querySelector('[data-slot=variacion]')).toBeNull();
    expect(sinPermisos.raiz.querySelector('[data-slot=presupuestos]')).toBeNull();
    expect(sinPermisos.raiz.querySelector('[data-slot=gasto-inusual]')).toBeNull();

    const conPermisos = montar([
      P.dashboard.kpi.ingresos,
      P.dashboard.tabla.ver,
      P.cuentas.categorias.listar,
      P.dashboard.widget.categorias,
    ]);
    expect(conPermisos.raiz.querySelectorAll('fin-kpi')).toHaveLength(1);
    expect(conPermisos.raiz.querySelector('[data-slot=presupuestos]')).not.toBeNull();
    expect(conPermisos.raiz.querySelector('[data-slot=gasto-inusual]')).not.toBeNull();
    expect(conPermisos.raiz.querySelector('[data-slot=categorias]')).not.toBeNull();
  });

  it('agrupa el flujo por semanas del mes con el saldo acumulado', () => {
    const { fixture } = montar([P.dashboard.widget.flujo]);

    const tramos = fixture.componentInstance.tramos();
    expect(tramos.map((tramo) => tramo.saldo)).toEqual([1100, 600]);
  });

  it('sin base de comparación muestra guion en vez de inventar un porcentaje', () => {
    const datos = datosDeLaPantalla({ historial: signal([punto(1200, 600)]), historialAnual: signal([]) });
    const { fixture } = montar([P.dashboard.kpi.ingresos], datos);
    const resumen = fixture.componentInstance;

    expect(resumen.cambioDeIngresos()).toBeNull();
    expect(resumen.porcentajeConSigno(null)).toBe('sin datos');
    expect(resumen.porcentajeConSigno(12.4)).toBe('+12 %');
    expect(resumen.porcentajeConSigno(-3.26)).toBe('-3.3 %');
  });

  it('colorea según si subir es bueno o malo', () => {
    const { fixture } = montar([]);
    const resumen = fixture.componentInstance;

    expect(resumen.claseDeVariacion(10, true)).toBe('text-success');
    expect(resumen.claseDeVariacion(10, false)).toBe('text-destructive');
    expect(resumen.claseDeVariacion(-10, false)).toBe('text-success');
    expect(resumen.claseDeVariacion(null, true)).toBe('text-muted-foreground');
  });
});
