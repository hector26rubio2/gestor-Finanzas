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
    session: sesionDe().conCapacidad(
      P.planificacion.deudas.ver,
      P.planificacion.compras.ver,
      P.planificacion.vacaciones.ver,
      P.planificacion.inversiones.ver,
    ),
    data: datosDe({
      people: [{ id: 'p-banco', name: 'Banco', kind: 'institution', owed: 0, owing: 1_000_000 }],
    }),
    providers: [provideRouter([]) as unknown as Provider],
    transport,
  });
  montado.cambios();
  return montado.component.sim;
}

const suma = (valores: readonly number[]) => valores.reduce((total, valor) => total + valor, 0);

describe('simulador: ingresos y gastos adicionales', () => {
  it('agregar un ingreso lo lista con el nombre «n» y un monto inicial de 200 mil', () => {
    const sim = montar();

    sim.agregarCambio('ingreso');
    sim.agregarCambio('ingreso');

    expect(sim.cambiosDeFlujo()).toHaveLength(2);
    expect(sim.cambiosDeFlujo()[0]).toMatchObject({ tipo: 'ingreso', monto: 200_000, desde: 1, hasta: null });
    expect(sim.cambiosDeFlujo()[0].nombre).not.toBe(sim.cambiosDeFlujo()[1].nombre);
  });

  it('un ingreso suma al flujo mensual y no toca los gastos', () => {
    const sim = montar();
    const gastosAntes = suma(sim.flujoMensual().gasto);
    const ingresosAntes = suma(sim.flujoMensual().ingreso);

    sim.agregarCambio('ingreso');

    expect(suma(sim.flujoMensual().ingreso)).toBeGreaterThan(ingresosAntes);
    expect(suma(sim.flujoMensual().gasto)).toBe(gastosAntes);
  });

  it('un gasto suma a los gastos y no toca los ingresos', () => {
    const sim = montar();
    const ingresosAntes = suma(sim.flujoMensual().ingreso);
    const gastosAntes = suma(sim.flujoMensual().gasto);

    sim.agregarCambio('gasto');

    expect(suma(sim.flujoMensual().gasto)).toBeGreaterThan(gastosAntes);
    expect(suma(sim.flujoMensual().ingreso)).toBe(ingresosAntes);
  });

  it('editar el monto cambia el flujo y quitarlo lo devuelve a como estaba', () => {
    const sim = montar();
    const antes = suma(sim.flujoMensual().ingreso);
    sim.agregarCambio('ingreso');
    const [cambio] = sim.cambiosDeFlujo();
    const conPrimerMonto = suma(sim.flujoMensual().ingreso);

    sim.editarCambio(cambio.id, { monto: 400_000 });
    expect(suma(sim.flujoMensual().ingreso)).toBeGreaterThan(conPrimerMonto);

    sim.quitarCambio(cambio.id);
    expect(sim.cambiosDeFlujo()).toEqual([]);
    expect(suma(sim.flujoMensual().ingreso)).toBe(antes);
  });
});

describe('simulador: deudas, abonos y tasas', () => {
  it('agregar una deuda hipotética la suma a las del escenario', () => {
    const sim = montar();
    const antes = sim.deudasDelEscenario().length;

    sim.agregarDeuda();

    expect(sim.hipoteticas()).toHaveLength(1);
    expect(sim.deudasDelEscenario()).toHaveLength(antes + 1);
  });

  it('un abono y un cambio de tasa se agregan sobre la primera deuda del escenario', () => {
    const sim = montar();
    const primera = sim.deudasDelEscenario()[0];

    sim.agregarEvento('abono');
    sim.agregarEvento('tasa');

    const [abono, tasa] = sim.eventos();
    expect(abono).toMatchObject({ tipo: 'abono', deudaId: primera.id, monto: 500_000 });
    expect(tasa).toMatchObject({ tipo: 'tasa', deudaId: primera.id });
  });

  it('editar un abono cambia solo su monto y mes', () => {
    const sim = montar();
    sim.agregarEvento('abono');
    const [abono] = sim.eventos();

    sim.editarEvento(abono.id, { monto: 900_000, mes: 6 });

    expect(sim.eventos()[0]).toMatchObject({ tipo: 'abono', monto: 900_000, mes: 6, deudaId: abono.deudaId });
  });

  it('quitar una deuda hipotética se lleva también sus abonos y tasas', () => {
    const sim = montar();
    sim.agregarDeuda();
    const [hipotetica] = sim.hipoteticas();
    sim.eventos.set([{ tipo: 'abono', id: 'e1', deudaId: hipotetica.id, mes: 2, monto: 100_000 }]);

    sim.quitarHipotetica(hipotetica.id);

    expect(sim.hipoteticas()).toEqual([]);
    expect(sim.eventos()).toEqual([]);
  });

  it('sin deudas no se puede agregar un abono', () => {
    const sim = montar();
    sim.alternarDeuda('persona:p-banco', false);

    sim.agregarEvento('abono');

    expect(sim.eventos()).toEqual([]);
  });

  it('restablecer deja el escenario como el inicial', () => {
    const sim = montar();
    sim.agregarDeuda();
    sim.agregarEvento('abono');
    sim.agregarCambio('gasto');
    sim.abonoMensual.set(500_000);
    sim.alternarDeuda('persona:p-banco', false);

    sim.restablecer();

    expect(sim.hipoteticas()).toEqual([]);
    expect(sim.eventos()).toEqual([]);
    expect(sim.cambiosDeFlujo()).toEqual([]);
    expect(sim.abonoMensual()).toBe(0);
    expect([...sim.excluidas()]).toEqual([]);
  });
});
