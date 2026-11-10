import { provideRouter } from '@angular/router';
import { type Provider } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { PlanningTabComponent } from './planning-tab';
import { VistasGuardadasComponent } from '@shared/vistas-guardadas';

const transportDePlanificacion = () =>
  new TransportFalso()
    .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
    .responder(/^GET \/api\/v1\/people\/debt-positions/, { body: [] })
    .responder(/^GET \/api\/v1\/planning\/plans/, { body: [] });

describe('la pestaña de planificación (smoke)', () => {
  it('renderiza con una sesión con permisos y las deudas de datosDe', async () => {
    const { fixture, component, cambios, estable } = pruebaRender(PlanningTabComponent, {
      session: sesionDe().conCapacidad(
        P.planificacion.deudas.ver,
        P.planificacion.compras.ver,
        P.planificacion.vacaciones.ver,
        P.planificacion.inversiones.ver,
        'planificacion.planes.crear',
      ),
      data: datosDe({
        accounts: [
          { id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0, annualRate: 26.82 },
        ],
        movements: [
          {
            id: 'm-compra',
            date: '2026-01-05',
            description: 'Compra grande',
            accountId: 'tarjeta-1',
            category: 'Compras',
            kind: 'expense',
            amount: -2_000_000,
            status: 'confirmed',
          },
        ],
        people: [{ id: 'p-banco', name: 'Banco', kind: 'institution', owed: 0, owing: 1_000_000 }],
      }),
      providers: [provideRouter([]) as unknown as Provider],
      transport: transportDePlanificacion(),
    });
    cambios();
    await estable();

    expect(component.sim.hayDeudas()).toBe(true);
    expect(component.sim.deudasDeHoy().length).toBe(2);
    expect(fixture.nativeElement.textContent).not.toContain('planificacion.');
  });

  it('sin permisos muestra el mensaje de sin acceso en vez de pestañas', async () => {
    const { fixture, component, cambios, estable } = pruebaRender(PlanningTabComponent, {
      session: sesionDe().sinCapacidades(),
      data: datosDe(),
      providers: [provideRouter([]) as unknown as Provider],
      transport: transportDePlanificacion(),
    });
    cambios();
    await estable();

    expect(component.visiblePlanningTabs()).toEqual([]);
    expect(fixture.nativeElement.textContent).toBeTruthy();
  });

  it('entrar a la pantalla restaura el estado guardado que la vista entrega por (cargar)', async () => {
    const { fixture, component, cambios, estable } = pruebaRender(PlanningTabComponent, {
      session: sesionDe().conCapacidad(
        P.planificacion.deudas.ver,
        P.planificacion.compras.ver,
        P.planificacion.vacaciones.ver,
        P.planificacion.inversiones.ver,
      ),
      data: datosDe(),
      providers: [provideRouter([]) as unknown as Provider],
      transport: transportDePlanificacion(),
    });
    cambios();
    await estable();
    expect(component.sim.abonoMensual()).toBe(0);

    // el guardado que la vista de planes entrega al cargar (EstadoGuardado v1)
    const guardado = JSON.stringify({
      version: 1,
      abonoMensual: 650_000,
      orden: 'saldo',
      compra: { monto: 2_000_000, nombre: 'Portátil', cuotas: 18, tasa: 2.2, mes: 4 },
    });
    const vista = fixture.debugElement
      .query(By.directive(VistasGuardadasComponent))
      .injector.get(VistasGuardadasComponent);
    vista.cargar.emit({ json: guardado, soloLectura: false });
    cambios();

    expect(component.sim.abonoMensual()).toBe(650_000);
    expect(component.sim.orden()).toBe('saldo');
    expect(component.sim.compraMonto()).toBe(2_000_000);
    expect(component.sim.compraNombre()).toBe('Portátil');
  });

  it('salir y volver a la pantalla: el tab se destruye y recrea y el guardado se re-aplica en la instancia nueva', async () => {
    // navegación simulada: destruir el componente (fixture.destroy()) y renderizarlo de nuevo
    // con un TestBed fresco es lo que hace pruebaRender; el SimuladorDePlanificacion está
    // scoped al componente (providers del PlanningTabComponent) así que cada instancia es nueva.
    const opciones = {
      session: sesionDe().conCapacidad(
        P.planificacion.deudas.ver,
        P.planificacion.compras.ver,
        P.planificacion.vacaciones.ver,
        P.planificacion.inversiones.ver,
      ),
      data: datosDe(),
      providers: [provideRouter([]) as unknown as Provider],
      transport: transportDePlanificacion(),
    };

    const pantalla = pruebaRender(PlanningTabComponent, opciones);
    pantalla.cambios();
    await pantalla.estable();
    expect(pantalla.component.sim.abonoMensual()).toBe(0);

    // el usuario guarda el plan: EstadoGuardado v1 guardado en la vista de planes
    const guardado = JSON.stringify({
      version: 1,
      abonoMensual: 650_000,
      orden: 'saldo',
      compra: { monto: 2_000_000, nombre: 'Portátil', cuotas: 18, tasa: 2.2, mes: 4 },
    });
    const vistaSalida = pantalla.fixture.debugElement
      .query(By.directive(VistasGuardadasComponent))
      .injector.get(VistasGuardadasComponent);
    vistaSalida.cargar.emit({ json: guardado, soloLectura: false });
    await pantalla.estable();
    expect(pantalla.component.sim.abonoMensual()).toBe(650_000);

    // --- destructor del componente (como al navegar fuera del tab)
    pantalla.fixture.destroy();
    await pantalla.estable();

    // --- re-render (como al volver al tab): instancia nueva, NO debe arrastrar estado
    const regreso = pruebaRender(PlanningTabComponent, opciones);
    regreso.cambios();
    await regreso.estable();
    expect(regreso.component.sim.abonoMensual()).toBe(0);
    expect(regreso.component.sim.orden()).toBe('tasa');
    expect(regreso.component.sim.compraMonto()).toBe(0);

    // al volver, la vista de planes entrega (cargar) el guardado otra vez — el binding
    // de planning-tab.html `(cargar)="sim.restaurar($event.json)"` re-aplica el estado
    const vistaRegreso = regreso.fixture.debugElement
      .query(By.directive(VistasGuardadasComponent))
      .injector.get(VistasGuardadasComponent);
    vistaRegreso.cargar.emit({ json: guardado, soloLectura: false });
    await regreso.estable();

    expect(regreso.component.sim.abonoMensual()).toBe(650_000);
    expect(regreso.component.sim.orden()).toBe('saldo');
    expect(regreso.component.sim.compraMonto()).toBe(2_000_000);
    expect(regreso.component.sim.compraNombre()).toBe('Portátil');
    expect(regreso.component.sim.compraCuotas()).toBe(18);
    expect(regreso.component.sim.compraTasa()).toBe(2.2);
    expect(regreso.component.sim.compraMes()).toBe(4);
  });
});

describe('los montos de la planificación (separador de miles)', () => {
  async function montar() {
    const pantalla = pruebaRender(PlanningTabComponent, {
      session: sesionDe().conCapacidad(
        P.planificacion.deudas.ver,
        P.planificacion.compras.ver,
        P.planificacion.vacaciones.ver,
        P.planificacion.inversiones.ver,
      ),
      data: datosDe({
        accounts: [
          { id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0, annualRate: 26.82 },
        ],
        movements: [
          {
            id: 'm-compra',
            date: '2026-01-05',
            description: 'Compra grande',
            accountId: 'tarjeta-1',
            category: 'Compras',
            kind: 'expense',
            amount: -2_000_000,
            status: 'confirmed',
          },
        ],
        people: [{ id: 'p-banco', name: 'Banco', kind: 'institution', owed: 0, owing: 1_000_000 }],
      }),
      providers: [provideRouter([]) as unknown as Provider],
      transport: transportDePlanificacion(),
    });
    pantalla.cambios();
    await pantalla.estable();
    return pantalla;
  }

  function camposDeMonto(raiz: HTMLElement): HTMLInputElement[] {
    return [...raiz.querySelectorAll<HTMLInputElement>('input[finMonto]')];
  }

  function escribir(campo: HTMLInputElement, texto: string): void {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
  }

  it('la compra muestra el separador y guarda el número exacto', async () => {
    const { fixture, component, cambios } = await montar();
    component.planningTab.set('Compra');
    cambios();

    escribir(camposDeMonto(fixture.nativeElement)[0], '12500000');
    cambios();

    expect(camposDeMonto(fixture.nativeElement)[0].value).toBe('12.500.000');
    expect(component.sim.compraMonto()).toBe(12_500_000);
  });

  it('la meta de vacaciones y el ahorro inicial usan el separador', async () => {
    const { fixture, component, cambios } = await montar();
    component.planningTab.set('Vacaciones');
    cambios();

    const [meta, ahorro] = camposDeMonto(fixture.nativeElement);
    escribir(meta, '8000000');
    escribir(ahorro, '1250000');
    cambios();

    expect(meta.value).toBe('8.000.000');
    expect(ahorro.value).toBe('1.250.000');
    expect(component.sim.metaMonto()).toBe(8_000_000);
    expect(component.sim.metaAhorroInicial()).toBe(1_250_000);
  });

  it('el aporte inicial y el mensual de la inversión usan el separador', async () => {
    const { fixture, component, cambios } = await montar();
    component.planningTab.set('Inversión');
    cambios();

    const [inicial, aporte] = camposDeMonto(fixture.nativeElement);
    escribir(inicial, '30000000');
    escribir(aporte, '450000');
    cambios();

    expect(inicial.value).toBe('30.000.000');
    expect(aporte.value).toBe('450.000');
    expect(component.sim.inversionInicial()).toBe(30_000_000);
    expect(component.sim.inversionAporte()).toBe(450_000);
  });

  it('el abono mensual y el saldo de cada deuda usan el separador', async () => {
    const { fixture, component, cambios } = await montar();

    const campos = camposDeMonto(fixture.nativeElement);
    const abono = campos.find((campo) => campo.value === '0' || campo.value === '')!;
    escribir(abono, '1500000');
    cambios();

    expect(abono.value).toBe('1.500.000');
    expect(component.sim.abonoMensual()).toBe(1_500_000);
    const saldos = campos.filter((campo) => campo !== abono);
    expect(saldos.length).toBeGreaterThan(0);
    escribir(saldos[0], '4200000');
    cambios();
    expect(saldos[0].value).toBe('4.200.000');
  });
});
