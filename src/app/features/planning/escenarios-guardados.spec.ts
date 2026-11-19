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
    session: sesionDe().conCapacidad(P.planificacion.deudas.ver),
    data: datosDe({
      people: [{ id: 'p-banco', name: 'Banco', kind: 'institution', owed: 0, owing: 1_000_000 }],
    }),
    providers: [provideRouter([]) as unknown as Provider],
    transport,
  });
  montado.cambios();
  return montado.component.sim;
}

describe('simulador: guardar, comparar y reabrir escenarios', () => {
  it('dos escenarios guardados con ajustes distintos quedan con series distintas', () => {
    const sim = montar();
    sim.guardarEscenario('Sin abono');
    sim.abonoMensual.set(300_000);
    sim.guardarEscenario('Con abono');

    const [sinAbono, conAbono] = sim.escenariosGuardados();

    expect([sinAbono.nombre, conAbono.nombre]).toEqual(['Sin abono', 'Con abono']);
    expect(conAbono.saldoTotal).not.toEqual(sinAbono.saldoTotal);
  });

  it('el comparador lista el actual, la base y los guardados, en ese orden', () => {
    const sim = montar();
    sim.guardarEscenario('Uno');
    sim.guardarEscenario('Dos');

    expect(
      sim
        .escenariosAComparar()
        .map((e) => e.nombre)
        .slice(2),
    ).toEqual(['Uno', 'Dos']);
    expect(
      sim
        .escenariosAComparar()
        .slice(0, 2)
        .map((e) => e.id),
    ).toEqual(['actual', 'base']);
  });

  it('un escenario guardado no cambia cuando se sigue ajustando el simulador', () => {
    const sim = montar();
    sim.guardarEscenario('Foto');
    const antes = sim.escenariosGuardados()[0].saldoTotal;

    sim.abonoMensual.set(900_000);

    expect(sim.escenariosGuardados()[0].saldoTotal).toEqual(antes);
  });

  it('sin nombre se llaman «Escenario n» sin repetirse', () => {
    const sim = montar();
    sim.guardarEscenario('');
    sim.guardarEscenario('   ');
    sim.guardarEscenario('');

    const nombres = sim.escenariosGuardados().map((e) => e.nombre);

    expect(new Set(nombres).size).toBe(3);
  });

  it('guarda como máximo 5 y descarta el más viejo', () => {
    const sim = montar();
    for (let i = 1; i <= 7; i++) sim.guardarEscenario(`E${i}`);

    expect(sim.escenariosGuardados().map((e) => e.nombre)).toEqual(['E3', 'E4', 'E5', 'E6', 'E7']);
  });

  it('quitar uno deja los demás intactos', () => {
    const sim = montar();
    sim.guardarEscenario('A');
    sim.guardarEscenario('B');
    sim.guardarEscenario('C');

    sim.quitarEscenario(sim.escenariosGuardados()[1].id);

    expect(sim.escenariosGuardados().map((e) => e.nombre)).toEqual(['A', 'C']);
  });

  it('reabrir un plan guardado restaura ajustes y escenarios tal cual', () => {
    const sim = montar();
    sim.abonoMensual.set(250_000);
    sim.agregarCambio('ingreso');
    sim.guardarEscenario('Mi plan');
    const json = sim.estado();
    const escenarioAntes = sim.escenario().saldoTotal;
    const guardadosAntes = sim.escenariosGuardados();

    sim.restablecer();
    sim.restaurar(json);

    expect(sim.abonoMensual()).toBe(250_000);
    expect(sim.cambiosDeFlujo()).toHaveLength(1);
    expect(sim.escenariosGuardados()).toEqual(guardadosAntes);
    expect(sim.escenario().saldoTotal).toEqual(escenarioAntes);
  });

  it('reabrir un plan sustituye los escenarios que había, no los mezcla', () => {
    const sim = montar();
    sim.guardarEscenario('Del plan');
    const json = sim.estado();
    sim.guardarEscenario('Extra');

    sim.restaurar(json);

    expect(sim.escenariosGuardados().map((e) => e.nombre)).toEqual(['Del plan']);
  });
});
