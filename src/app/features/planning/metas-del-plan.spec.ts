import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { PlanningTabComponent } from './planning-tab';

function montar() {
  const transport = new TransportFalso()
    .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
    .responder(/^GET \/api\/v1\/people\/debt-positions/, { body: [] })
    .responder(/^GET \/api\/v1\/planning\/plans/, { body: [] });
  const montado = pruebaRender(PlanningTabComponent, {
    session: sesionDe().conCapacidad(P.planificacion.vacaciones.ver, P.planificacion.inversiones.ver),
    data: datosDe(),
    providers: [provideRouter([]) as unknown as Provider],
    transport,
  });
  montado.cambios();
  montado.component.planningTab.set('Vacaciones');
  montado.cambios();
  return montado.component;
}

describe('Planificación: la meta de Vacaciones usa lo ahorrado', () => {
  it('falta la meta menos el ahorro inicial', () => {
    const { sim } = montar();
    sim.metaMonto.set(5_000_000);
    sim.metaAhorroInicial.set(1_200_000);

    expect(sim.faltaParaLaMeta()).toBe(3_800_000);
  });

  it('con lo ahorrado ya cubriendo la meta no falta nada', () => {
    const { sim } = montar();
    sim.metaMonto.set(2_000_000);
    sim.metaAhorroInicial.set(3_000_000);

    expect(sim.faltaParaLaMeta()).toBe(0);
    expect(sim.aporteNecesarioMeta()).toBe(0);
  });

  it('el ahorro mensual necesario reparte lo que falta entre los meses hasta la fecha', () => {
    const { sim } = montar();
    sim.metaMonto.set(6_000_000);
    sim.metaAhorroInicial.set(1_200_000);

    expect(sim.aporteNecesarioMeta()).toBe(Math.round(4_800_000 / sim.mesesAlaMeta()));
  });

  it('con la meta ya ahorrada se llega ya en el primer mes, y sin ahorro no se llega', () => {
    const { sim } = montar();
    sim.metaMonto.set(10_000_000);
    const sinAhorro = sim.escenario().mesDeMeta;
    sim.metaAhorroInicial.set(100_000_000);

    expect(sinAhorro).toBeNull();
    expect(sim.escenario().mesDeMeta).toBe(0);
  });

  it('la pestaña muestra la tarjeta «falta para la meta» con el monto', () => {
    const componente = montar();
    componente.sim.metaMonto.set(5_000_000);
    componente.sim.metaAhorroInicial.set(1_000_000);

    const montos = componente.metricas().map((m) => m.value.replace(/\D/g, ''));

    expect(montos).toContain('4000000');
  });
});
