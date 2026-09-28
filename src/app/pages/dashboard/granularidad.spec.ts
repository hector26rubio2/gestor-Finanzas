import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { AccountFormComponent } from '@features/account-form';
import {
  MovementFormComponent,
  MovementInstallmentFieldsComponent,
  MovementCategoryFieldComponent,
} from '@features/movement-form';
import { DashboardComponent } from './dashboard';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';

function preparar(permisos: readonly string[]) {
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      {
        provide: FinanceApiClient,
        useValue: { dashboard: vi.fn(() => of(null)), saveDashboardLayout: vi.fn(() => of(null)) },
      },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [...permisos] });
  return store;
}

const VER_WIDGETS = [
  P.dashboard.widget.flujo,
  P.dashboard.widget.categorias,
  P.dashboard.widget.cuentas,
  P.dashboard.widget.tendencia,
  P.dashboard.widget.compromisos,
  P.dashboard.widget.salud,
];

function abrirFormulario(kind: string) {
  TestBed.inject(AppStore).form.set({ kind } as never);
}

describe('dashboard: reorganizar no es cambiar de visualización', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('con solo el permiso de orden se puede mover pero no cambiar el tipo ni ocultar', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.orden.editar, ...VER_WIDGETS]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;

    expect(componente.puedePersonalizar()).toBe(true);

    const antes = componente.widgets().map((w) => w.id);
    componente.edicion.move(antes[1], -1);
    expect(componente.widgets().map((w) => w.id)[0]).toBe(antes[1]);

    const tipoPrevio = componente.widgets()[0].type;
    componente.edicion.changeType(componente.widgets()[0].id, 'heatmap');
    expect(componente.widgets()[0].type).toBe(tipoPrevio);

    const cuantos = componente.widgets().length;
    componente.edicion.hide(componente.widgets()[0].id);
    expect(componente.widgets()).toHaveLength(cuantos);
  });

  it('el panel de diseño no se dibuja vacío para quien solo reorganiza', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.orden.editar, ...VER_WIDGETS]);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.customizing.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('aside[data-slot="customize"]')).toBeNull();
  });

  it('sin ninguna de las cuatro acciones el botón de personalizar no se ofrece', () => {
    preparar([P.dashboard.ver]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;
    expect(componente.puedePersonalizar()).toBe(false);
  });

  it('cada KPI de cabecera responde a su propio permiso', () => {
    preparar([P.dashboard.ver, P.dashboard.kpi.gastos]);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.algunKpi()).toBe(true);
    const etiquetas = [...fixture.nativeElement.querySelectorAll('fin-kpi-strip fin-kpi')].map((n: Element) =>
      n.textContent?.trim(),
    );
    expect(etiquetas).toHaveLength(1);
    expect(etiquetas[0]).toContain('Gastos');
  });

  it('crear un widget requiere su permiso, aunque se pueda reorganizar', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.orden.editar, ...VER_WIDGETS]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;
    const cuantos = componente.widgets().length;

    componente.agregarWidget({ id: 'propio', title: 'Mi análisis', kicker: '', type: 'bar', wide: true });
    expect(componente.widgets()).toHaveLength(cuantos);
  });

  it('sin widget.tipo.editar no cambian ni la dimensión, ni la métrica, ni la meta', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.orden.editar, ...VER_WIDGETS]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;
    const compromisos = componente.widgets().find((w) => w.id === 'commitments')!;
    const { dimension, measure } = compromisos;

    componente.edicion.changeDimension(compromisos.id, 'category');
    componente.edicion.changeMeasure(compromisos.id, 'income');
    componente.edicion.changeGoal(compromisos.id, 'goalTarget', '999');

    const actual = componente.widgets().find((w) => w.id === 'commitments')!;
    expect(actual.dimension).toBe(dimension);
    expect(actual.measure).toBe(measure);
    expect(actual.goalTarget).toBeUndefined();
  });

  it('con widget.tipo.editar sí cambian', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.tipo.editar, ...VER_WIDGETS]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;
    componente.edicion.changeDimension('commitments', 'category');
    expect(componente.widgets().find((w) => w.id === 'commitments')!.dimension).toBe('category');
  });

  it('crear un indicador de la franja de arriba requiere su permiso', () => {
    preparar([P.dashboard.ver, P.dashboard.kpi.gastos]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;
    const cuantos = componente.customKpis().length;

    componente.newKpiLabel = 'Mi indicador';
    componente.createKpi(new Event('submit'));
    expect(componente.customKpis()).toHaveLength(cuantos);
  });

  it('quitar un indicador de la franja de arriba requiere su permiso', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.propios]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;
    const cuantos = componente.customKpis().length;

    componente.removeKpi(componente.customKpis()[0].id);
    expect(componente.customKpis()).toHaveLength(cuantos);
  });

  it('widget.propios enseña la galería y los indicadores creados a mano, no los que tienen su propio permiso', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.propios]);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const componente = fixture.componentInstance;

    const titulos = componente.widgets().map((w) => w.title);
    expect(titulos).toContain('Ingresos en el tiempo');
    expect(titulos).not.toContain('Flujo de caja');

    const etiquetasKpi = [...fixture.nativeElement.querySelectorAll('fin-kpi-strip fin-kpi')].map(
      (n: Element) => n.textContent?.trim() ?? '',
    );
    expect(etiquetasKpi.some((t) => t.includes('Promedio por movimiento'))).toBe(true);
    expect(etiquetasKpi.some((t) => t.includes('Gastos'))).toBe(false);
  });
});

describe('movimientos: cada figura del ledger por separado', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sin el permiso de transferencia el tipo no aparece', () => {
    preparar([P.movimientos.ver, P.movimientos.crear]);
    abrirFormulario('expense');
    const componente = TestBed.createComponent(MovementFormComponent).componentInstance;

    expect(componente.types().map((t) => t.value)).toEqual(['expense', 'income']);
    expect(componente.operationTypeOptions().map((o) => o.value)).not.toContain('transfer');
  });

  it('con el permiso de transferencia el tipo vuelve', () => {
    preparar([P.movimientos.ver, P.movimientos.crear, P.movimientos.transferencias.crear]);
    abrirFormulario('expense');
    const componente = TestBed.createComponent(MovementFormComponent).componentInstance;

    expect(componente.operationTypeOptions().map((o) => o.value)).toContain('transfer');
  });

  it('préstamo y crédito se ofrecen con permisos distintos', () => {
    preparar([P.movimientos.ver, P.movimientos.crear, P.movimientos.prestamos.crear, P.personas.deudas.crear]);
    abrirFormulario('income');
    const componente = TestBed.createComponent(MovementFormComponent).componentInstance;

    const valores = componente.operationTypeOptions().map((opcion) => opcion.value);
    expect(valores).toContain('loan');
    expect(valores).toContain('received');
    expect(valores).not.toContain('credit');
  });

  it('la tasa mensual de las cuotas usa la de la tarjeta por defecto y se puede reemplazar', () => {
    preparar([P.movimientos.ver, P.movimientos.crear]);
    const fixture = TestBed.createComponent(MovementInstallmentFieldsComponent);
    fixture.componentInstance.model = { accountId: 'credit-emerald', installmentTotal: 6 };

    expect(fixture.componentInstance.cardMonthlyRate()).toBeUndefined();
    expect(fixture.componentInstance.monthlyRate()).toBeNull();
    expect(fixture.componentInstance.isOverridden()).toBe(false);

    fixture.componentInstance.onMonthlyRateChange(2.1);
    expect(fixture.componentInstance.monthlyRate()).toBe(2.1);
    expect(fixture.componentInstance.isOverridden()).toBe(true);

    fixture.componentInstance.useCardRate();
    expect(fixture.componentInstance.model['installmentRate']).toBeUndefined();
    expect(fixture.componentInstance.isOverridden()).toBe(false);
  });

  it('un gasto ofrece prestar pero no crédito, que es de ingreso', () => {
    preparar([
      P.movimientos.ver,
      P.movimientos.crear,
      P.movimientos.prestamos.crear,
      P.movimientos.creditos.crear,
      P.personas.prestamos.crear,
    ]);
    abrirFormulario('expense');
    const componente = TestBed.createComponent(MovementFormComponent).componentInstance;

    const valores = componente.operationTypeOptions().map((opcion) => opcion.value);
    expect(valores).toContain('loan');
    expect(valores).not.toContain('credit');
  });

  it('cambiar de gasto a ingreso en el mismo componente cambia las categorías ofrecidas', () => {
    preparar([P.movimientos.ver, P.movimientos.crear]);
    const categoria = { color: '#000', icon: '', parent: null, isActive: true, createdAt: '2026-01-01T00:00:00Z' };
    TestBed.inject(AppStore).categories.set([
      { ...categoria, id: 'gasto', name: 'Mercado', type: 2 },
      { ...categoria, id: 'ingreso', name: 'Salario', type: 1 },
    ]);
    const fixture = TestBed.createComponent(MovementCategoryFieldComponent);
    fixture.componentInstance.model = { category: '' };
    fixture.componentInstance.kind = 'expense';
    const deGasto = fixture.componentInstance.categoryOptions().map((o) => o.value);

    fixture.componentInstance.kind = 'income';
    const deIngreso = fixture.componentInstance.categoryOptions().map((o) => o.value);

    expect(deGasto).not.toEqual(deIngreso);
    expect(deIngreso).toContain('Salario');
  });
});

describe('cuentas: un tipo por permiso', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('solo se ofrecen los tipos concedidos', () => {
    preparar([P.cuentas.ver, P.cuentas.crear, P.cuentas.ahorro.crear]);
    const componente = TestBed.createComponent(AccountFormComponent).componentInstance;

    expect(componente.accountTypes().map((t) => t.value)).toEqual(['savings', 'checking', 'other']);
  });

  it('la tarjeta se concede aparte de la cuenta de ahorro', () => {
    preparar([P.cuentas.ver, P.cuentas.crear, P.cuentas.tarjetas.crear]);
    const componente = TestBed.createComponent(AccountFormComponent).componentInstance;

    expect(componente.accountTypes().map((t) => t.value)).toEqual(['other', 'credit']);
  });
});
