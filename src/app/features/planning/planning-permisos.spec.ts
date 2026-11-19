import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { PlanningTabComponent } from './planning-tab';

const transporte = () =>
  new TransportFalso()
    .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
    .responder(/^GET \/api\/v1\/people\/debt-positions/, { body: [] })
    .responder(/^GET \/api\/v1\/planning\/plans/, { body: [] });

function montar(permisos: string[]) {
  const montado = pruebaRender(PlanningTabComponent, {
    session: permisos.length ? sesionDe().conCapacidad(...permisos) : sesionDe().sinCapacidades(),
    data: datosDe(),
    providers: [provideRouter([]) as unknown as Provider],
    transport: transporte(),
  });
  montado.cambios();
  return montado;
}

const VER = {
  Deudas: P.planificacion.deudas.ver,
  Compra: P.planificacion.compras.ver,
  Vacaciones: P.planificacion.vacaciones.ver,
  Inversión: P.planificacion.inversiones.ver,
} as const;

describe('Planificación: cada pestaña respeta su permiso', () => {
  it('con todos los permisos hay cuatro pestañas, en el orden de siempre', () => {
    const { component } = montar(Object.values(VER));

    expect(component.visiblePlanningTabs()).toEqual(['Deudas', 'Compra', 'Vacaciones', 'Inversión']);
  });

  it.each(Object.entries(VER))('solo con el permiso de «%s» solo se ve esa pestaña', (pestana, permiso) => {
    const { component } = montar([permiso]);

    expect(component.visiblePlanningTabs()).toEqual([pestana]);
  });

  it.each(Object.entries(VER))('si «%s» es la única visible, es la que queda elegida', (pestana, permiso) => {
    const { component, cambios } = montar([permiso]);
    cambios();

    expect(component.planningTab()).toBe(pestana);
  });

  it('sin ningún permiso de planificación no hay pestañas', () => {
    const { component } = montar([]);

    expect(component.visiblePlanningTabs()).toEqual([]);
  });

  it('un permiso de otra pestaña no abre la de deudas', () => {
    const { component } = montar([P.planificacion.compras.ver, P.planificacion.inversiones.ver]);

    expect(component.visiblePlanningTabs()).toEqual(['Compra', 'Inversión']);
    expect(component.visiblePlanningTabs()).not.toContain('Deudas');
  });

  it('el simulador sigue a la pestaña elegida', () => {
    const { component, cambios } = montar(Object.values(VER));

    component.planningTab.set('Vacaciones');
    cambios();

    expect(component.sim.pestana()).toBe('Vacaciones');
  });

  it('cada pestaña guarda su propio tipo de plan', () => {
    const { component } = montar(Object.values(VER));

    const tipos = (['Deudas', 'Compra', 'Vacaciones', 'Inversión'] as const).map((pestana) => {
      component.planningTab.set(pestana);
      return component.tipoDePlan();
    });

    expect(tipos).toEqual(['plan.deudas', 'plan.compras', 'plan.vacaciones', 'plan.inversiones']);
  });
});
