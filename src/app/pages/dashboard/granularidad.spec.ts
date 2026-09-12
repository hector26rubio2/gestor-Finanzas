import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '../../core/api-client';
import { P } from '../../core/permissions';
import { RUNTIME_CONFIG } from '../../core/runtime';
import { DemoStore } from '../../core/store';
import { AccountFormComponent, MovementFormComponent } from '../../forms';
import { DashboardComponent } from './dashboard';

/**
 * Antes una casilla concedía una capacidad entera: marcar «administrar cuentas» daba
 * crear, editar y deshabilitar de golpe. Estas pruebas fijan que cada acción se libera
 * por separado y que la interfaz lo refleja control a control.
 */
function preparar(permisos: readonly string[]) {
  window.__FINANZAS_CONFIG__ = { mode: 'demo' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { mode: 'demo' } },
      { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(null)) } },
    ],
  });
  const store = TestBed.inject(DemoStore);
  store.user.set({ ...store.users[0], capabilities: [...permisos] });
  return store;
}

/** Los seis widgets predefinidos, para probar las acciones sin que la rejilla quede vacía. */
const VER_WIDGETS = [
  P.dashboard.widget.flujo,
  P.dashboard.widget.categorias,
  P.dashboard.widget.cuentas,
  P.dashboard.widget.tendencia,
  P.dashboard.widget.compromisos,
  P.dashboard.widget.salud,
];

/** El formulario de movimiento se abre desde el almacén: sin eso no hay qué montar. */
function abrirFormulario(kind: string) {
  TestBed.inject(DemoStore).form.set({ kind } as never);
}

describe('dashboard: reorganizar no es cambiar de visualización', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('con solo el permiso de orden se puede mover pero no cambiar el tipo ni ocultar', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.orden.editar, ...VER_WIDGETS]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;

    expect(componente.puedePersonalizar()).toBe(true);

    const antes = componente.widgets().map((w) => w.id);
    componente.move(antes[1], -1);
    expect(componente.widgets().map((w) => w.id)[0]).toBe(antes[1]);

    const tipoPrevio = componente.widgets()[0].type;
    componente.changeType(componente.widgets()[0].id, 'heatmap');
    expect(componente.widgets()[0].type).toBe(tipoPrevio);

    const cuantos = componente.widgets().length;
    componente.hide(componente.widgets()[0].id);
    expect(componente.widgets()).toHaveLength(cuantos);
  });

  it('el panel de diseño no se dibuja vacío para quien solo reorganiza', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.orden.editar, ...VER_WIDGETS]);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.customizing.set(true);
    fixture.detectChanges();

    // Quedaba una caja con el título «Diseño del dashboard» y ningún botón dentro.
    expect(fixture.nativeElement.querySelector('aside.customize')).toBeNull();
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
    const etiquetas = [...fixture.nativeElement.querySelectorAll('.kpis demo-kpi')].map((n: Element) =>
      n.textContent?.trim(),
    );
    expect(etiquetas).toHaveLength(1);
    expect(etiquetas[0]).toContain('Gastos');
  });

  it('crear un widget requiere su permiso, aunque se pueda reorganizar', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.orden.editar, ...VER_WIDGETS]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;
    const cuantos = componente.widgets().length;

    componente.newWidgetTitle = 'Mi análisis';
    componente.createWidget(new Event('submit'));
    expect(componente.widgets()).toHaveLength(cuantos);
  });

  /*
   * El motor genérico (dimensión/métrica/meta) y los indicadores de la franja de arriba
   * son controles nuevos sobre el mismo widget; comparten el permiso de siempre
   * (`widget.tipo.editar` para reconfigurar, `widget.crear`/`widget.deshabilitar` para
   * crear o quitar), pero nunca se habían probado por separado.
   */
  it('sin widget.tipo.editar no cambian ni la dimensión, ni la métrica, ni la meta', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.orden.editar, ...VER_WIDGETS]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;
    const compromisos = componente.widgets().find((w) => w.id === 'commitments')!;
    const { dimension, measure } = compromisos;

    componente.changeDimension(compromisos.id, 'category');
    componente.changeMeasure(compromisos.id, 'income');
    componente.changeGoal(compromisos.id, 'goalTarget', '999');

    const actual = componente.widgets().find((w) => w.id === 'commitments')!;
    expect(actual.dimension).toBe(dimension);
    expect(actual.measure).toBe(measure);
    expect(actual.goalTarget).toBeUndefined();
  });

  it('con widget.tipo.editar sí cambian', () => {
    preparar([P.dashboard.ver, P.dashboard.widget.tipo.editar, ...VER_WIDGETS]);
    const componente = TestBed.createComponent(DashboardComponent).componentInstance;
    componente.changeDimension('commitments', 'category');
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

    const etiquetasKpi = [...fixture.nativeElement.querySelectorAll('.kpis demo-kpi')].map(
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
  });

  it('con el permiso de transferencia el tipo vuelve', () => {
    preparar([P.movimientos.ver, P.movimientos.crear, P.movimientos.transferencias.crear]);
    abrirFormulario('expense');
    const componente = TestBed.createComponent(MovementFormComponent).componentInstance;

    expect(componente.types().map((t) => t.value)).toContain('transfer');
  });

  it('los campos de préstamo y de crédito son dos permisos distintos', () => {
    preparar([P.movimientos.ver, P.movimientos.crear, P.movimientos.prestamos.crear]);
    abrirFormulario('expense');
    const componente = TestBed.createComponent(MovementFormComponent).componentInstance;

    expect(componente.fieldVisible('loanRole')).toBe(true);
    componente.model['loanRole'] = 'lent';
    expect(componente.fieldVisible('loanProduct')).toBe(false);
  });

  it('prestar y deber se ofrecen por separado', () => {
    preparar([P.movimientos.ver, P.movimientos.crear, P.movimientos.prestamos.crear, P.personas.prestamos.crear]);
    abrirFormulario('expense');
    const componente = TestBed.createComponent(MovementFormComponent).componentInstance;
    const relacion = componente.fields().find((campo) => campo.key === 'loanRole');

    const valores = relacion?.options?.map((opcion) => opcion.value) ?? [];
    expect(valores).toContain('lent');
    expect(valores).not.toContain('borrowed');
  });
});

describe('cuentas: un tipo por permiso', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('solo se ofrecen los tipos concedidos', () => {
    preparar([P.cuentas.ver, P.cuentas.crear, P.cuentas.ahorro.crear]);
    const componente = TestBed.createComponent(AccountFormComponent).componentInstance;

    expect(componente.accountTypes().map((t) => t.value)).toEqual(['savings']);
  });

  it('la tarjeta se concede aparte de la cuenta de ahorro', () => {
    preparar([P.cuentas.ver, P.cuentas.crear, P.cuentas.tarjetas.crear]);
    const componente = TestBed.createComponent(AccountFormComponent).componentInstance;

    expect(componente.accountTypes().map((t) => t.value)).toEqual(['credit']);
  });
});
