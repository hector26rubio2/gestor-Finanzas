import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { Account, Movement, Person } from '@core/state';
import { mensualDesdeAnual } from '@core/utils/tasas';
import { CUOTAS_SUPUESTAS, TASA_MENSUAL_SUPUESTA_CREDITO, cuotaFija, saldoTrasCuotas } from '@shared/proyecciones';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { SimuladorDePlanificacion } from './simulador';

@Component({
  selector: 'prueba-simulador-de-planificacion',
  template: '',
  providers: [SimuladorDePlanificacion],
})
class HostSimulador {
  readonly sim = inject(SimuladorDePlanificacion);
}

const TARJETA: Account = {
  id: 'tarjeta-1',
  name: 'Visa',
  type: 'credit',
  currency: 'COP',
  openingBalance: 0,
  annualRate: 26.82,
};
const COMPRA_EN_TARJETA: Movement = {
  id: 'm-compra',
  date: '2026-01-05',
  description: 'Compra grande',
  accountId: 'tarjeta-1',
  category: 'Compras',
  kind: 'expense',
  amount: -2_000_000,
  status: 'confirmed',
};
const BANCO: Person = { id: 'p-banco', name: 'Banco', kind: 'institution', owed: 0, owing: 1_000_000 };

const tasaTarjeta = mensualDesdeAnual(26.82);
const TASA_BANCO = TASA_MENSUAL_SUPUESTA_CREDITO;
/** Lo que queda de la tarjeta viendo solo saldos (sin compras discriminadas). */
const SALDO_TARJETA = 2_000_000;
const SALDO_BANCO = 1_000_000;

describe('SimuladorDePlanificacion: el plan que se le muestra al usuario', () => {
  function montar() {
    return pruebaRender(HostSimulador, {
      session: sesionDe().sinCapacidades(),
      transport: new TransportFalso().responder(/^POST \/api\/v1\/movements\/search/, {
        body: { items: [], hasNext: false },
      }),
      data: datosDe({ accounts: [TARJETA], movements: [COMPRA_EN_TARJETA], people: [BANCO] }),
    }) as { component: HostSimulador; estable(): Promise<void> };
  }

  async function simuladorListo(): Promise<{ sim: SimuladorDePlanificacion; idTarjeta: string }> {
    const { component, estable } = montar();
    await estable();
    const sim = component.sim;
    const idTarjeta = sim.deudasReales().find((d) => d.tipo === 'tarjeta')!.id;
    return { sim, idTarjeta };
  }

  it('arma las deudas de hoy: la tarjeta por saldo y a quien se le debe', async () => {
    const { sim, idTarjeta } = await simuladorListo();
    const deudas = sim.deudasDeHoy();
    expect(deudas).toHaveLength(2);
    expect(deudas[0]).toMatchObject({
      id: idTarjeta,
      grupo: 'tarjeta:tarjeta-1',
      tipo: 'tarjeta',
      saldo: SALDO_TARJETA,
      tasaMensual: tasaTarjeta,
      cuotas: CUOTAS_SUPUESTAS,
    });
    expect(deudas[1]).toMatchObject({
      id: 'persona:p-banco',
      nombre: 'Banco',
      tipo: 'credito',
      saldo: SALDO_BANCO,
      tasaMensual: TASA_BANCO,
    });
    expect(sim.hayDeudas()).toBe(true);
    expect(sim.deudaTotal()).toBe(3_000_000);
  });

  it('con orden por tasa, el abono va primero a la deuda más cara hasta liquidarla', async () => {
    const { sim, idTarjeta } = await simuladorListo();
    sim.orden.set('tasa');
    // un abono que cubre justo el pendiente de la tarjeta tras su cuota del mes 0
    const abonoMensual = saldoTrasCuotas(SALDO_TARJETA, tasaTarjeta, CUOTAS_SUPUESTAS, 1);
    sim.abonoMensual.set(abonoMensual);
    const plan = sim.planDeAbono();
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({
      tipo: 'abono',
      mes: 0,
      deudaId: idTarjeta,
      monto: abonoMensual,
    });
    // mes 1: la tarjeta ya está liquidada; sigue el Banco, con el pendiente tras dos cuotas
    const pendienteBancoMes1 = saldoTrasCuotas(SALDO_BANCO, TASA_BANCO, CUOTAS_SUPUESTAS, 2);
    expect(plan[1]).toMatchObject({ tipo: 'abono', mes: 1, deudaId: 'persona:p-banco', monto: pendienteBancoMes1 });
  });

  it('con orden por saldo el abono arranca por la deuda más pequeña, aunque sea más barata', async () => {
    const { sim, idTarjeta } = await simuladorListo();
    sim.orden.set('saldo');
    const abono = saldoTrasCuotas(SALDO_BANCO, TASA_BANCO, CUOTAS_SUPUESTAS, 1);
    sim.abonoMensual.set(abono);
    const plan = sim.planDeAbono();
    expect(plan[0]).toMatchObject({ tipo: 'abono', mes: 0, deudaId: 'persona:p-banco', monto: abono });
    // el Banco quedó liquidado: en el mes 1 retoma la tarjeta
    expect(plan[1]).toMatchObject({ tipo: 'abono', mes: 1, deudaId: idTarjeta, monto: abono });
    expect(plan[2]).toMatchObject({ tipo: 'abono', mes: 2, deudaId: idTarjeta });
  });

  it('con un abono mucho mayor que el saldo, cada deuda recibe una vez su pendiente', async () => {
    const { sim, idTarjeta } = await simuladorListo();
    sim.abonoMensual.set(50_000_000);
    const plan = sim.planDeAbono();
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({
      mes: 0,
      deudaId: idTarjeta,
      monto: saldoTrasCuotas(SALDO_TARJETA, tasaTarjeta, CUOTAS_SUPUESTAS, 1),
    });
    expect(plan[1]).toMatchObject({
      mes: 0,
      deudaId: 'persona:p-banco',
      monto: saldoTrasCuotas(SALDO_BANCO, TASA_BANCO, CUOTAS_SUPUESTAS, 1),
    });
  });

  it('sin abono mensual no hay plan de abonos y el escenario cae al base', async () => {
    const { sim } = await simuladorListo();
    expect(sim.planDeAbono()).toEqual([]);
    expect(sim.palancas()).toEqual([]);
  });

  it('una deuda excluida sale del plan y del total', async () => {
    const { sim, idTarjeta } = await simuladorListo();
    sim.alternarDeuda('persona:p-banco', false);
    expect(sim.deudasDeHoy().map((d) => d.id)).toEqual([idTarjeta]);
    sim.abonoMensual.set(800_000);
    expect(
      sim.planDeAbono().some((p) => p.tipo === 'abono' && p.deudaId === 'persona:p-banco'),
    ).toBe(false);
    expect(sim.deudaTotal()).toBe(2_000_000);
    // volver a incluirla la regresa
    sim.alternarDeuda('persona:p-banco', true);
    expect(sim.deudasDeHoy()).toHaveLength(2);
  });

  it('un ajuste de saldo entra al plan en lugar de la deuda original', async () => {
    const { sim } = await simuladorListo();
    sim.ajustar('persona:p-banco', { saldo: 0 });
    expect(sim.deudasDeHoy().find((d) => d.id === 'persona:p-banco')?.saldo).toBe(0);
    sim.abonoMensual.set(800_000);
    expect(
      sim.planDeAbono().some((p) => p.tipo === 'abono' && p.deudaId === 'persona:p-banco'),
    ).toBe(false);
  });

  it('el ajuste de una hipotética cambia la deuda misma, sin registros de ajuste', async () => {
    const { sim } = await simuladorListo();
    sim.agregarDeuda();
    const [hipotetica] = sim.hipoteticas();
    expect(hipotetica).toMatchObject({
      saldo: 1_000_000,
      tasaMensual: 2.5,
      cuotas: CUOTAS_SUPUESTAS,
      tipo: 'hipotetica',
    });
    sim.ajustar(hipotetica.id, { saldo: 400_000 });
    expect(sim.hipoteticas()[0].saldo).toBe(400_000);
    expect(sim.ajustes()[hipotetica.id]).toBeUndefined();
    sim.renombrarHipotetica(hipotetica.id, 'Vacaciones');
    expect(sim.hipoteticas()[0].nombre).toBe('Vacaciones');
    sim.quitarHipotetica(hipotetica.id);
    expect(sim.hipoteticas()).toEqual([]);
  });

  it('una compra figurada entra al escenario con su cuota y su serie', async () => {
    const { sim } = await simuladorListo();
    sim.compraMonto.set(1_500_000);
    sim.compraCuotas.set(12);
    const compra = sim.compra();
    expect(compra).toMatchObject({
      id: 'compra:simulada',
      tipo: 'hipotetica',
      saldo: 1_500_000,
      tasaMensual: 2.5,
      desdeMes: 0,
    });
    expect(compra?.nombre).not.toBe('');
    expect(sim.cuotaDeLaCompra()).toBe(Math.round(cuotaFija(1_500_000, 2.5, 12)));
    expect(sim.deudaTotal()).toBe(4_500_000);
    const serie = sim.serieDeLaCompra();
    expect(serie).not.toBeNull();
    expect(serie?.inicio).toBe(0);
  });

  it('los eventos del escenario se convierten en palancas y se pueden editar', async () => {
    const { sim, idTarjeta } = await simuladorListo();
    sim.agregarEvento('abono');
    sim.agregarEvento('tasa');
    const eventos = sim.eventos();
    expect(eventos).toHaveLength(2);
    expect(eventos[0]).toMatchObject({ tipo: 'abono', mes: 3, monto: 500_000, deudaId: idTarjeta });
    expect(eventos[1]).toMatchObject({ tipo: 'tasa', mes: 3, deudaId: idTarjeta });
    // la tasa del evento baja medio punto sobre la deuda elegida
    expect(eventos[1]).toMatchObject({ tasaMensual: Math.max(0, tasaTarjeta - 0.5) });
    expect(
      sim.palancas().filter((p) => p.tipo === 'tasa').map((p) => (p.tipo === 'tasa' ? p.mes : -1)),
    ).toContain(3);

    sim.editarEvento(eventos[0].id, { mes: 5, monto: 250_000 });
    sim.editarEvento(eventos[1].id, { deudaId: 'persona:p-banco' });
    expect(sim.eventos()[0]).toMatchObject({ mes: 5, monto: 250_000 });
    expect(sim.eventos()[1]).toMatchObject({ deudaId: 'persona:p-banco' });

    sim.quitarEvento(eventos[0].id);
    expect(sim.eventos()).toHaveLength(1);
  });

  it('un evento de abono llega a la proyección: el apoyo baja el saldo y el interés del escenario', async () => {
    const { sim, idTarjeta } = await simuladorListo();
    // eventos aislados: sin plan de abonos y sin otros ajustes
    expect(sim.abonoMensual()).toBe(0);
    const serieAntes = sim.escenario().deudas.find((d) => d.id === idTarjeta)!;
    const interesAntes = sim.escenario().interesTotal;

    sim.agregarEvento('abono');
    sim.editarEvento(sim.eventos()[0].id, { mes: 3, monto: 500_000 });
    expect(sim.eventos()[0]).toMatchObject({ tipo: 'abono', mes: 3, monto: 500_000 });

    const serieDespues = sim.escenario().deudas.find((d) => d.id === idTarjeta)!;
    // el abono extra del mes 3 se refleja en el saldo del mes 6: baja más de lo abonado
    // (el interés ahorrado se suma a la caída) y el interés total del escenario baja
    expect(serieDespues.saldo[6]).toBeLessThan(serieAntes.saldo[6] - 400_000);
    expect(serieDespues.saldo[6]).toBeGreaterThan(serieAntes.saldo[6] - 700_000);
    expect(sim.escenario().interesTotal).toBeLessThan(interesAntes);
  });

  it('el escenario con plan compara contra el base: menos interés y cuota para liquidar', async () => {
    const { sim, idTarjeta } = await simuladorListo();
    const abono = saldoTrasCuotas(SALDO_TARJETA, tasaTarjeta, CUOTAS_SUPUESTAS, 1);
    sim.abonoMensual.set(abono);
    expect(sim.cuotaDelPrimerMes()).toBeGreaterThan(0);
    expect(sim.interesAhorrado()).toBeGreaterThan(0);
    expect(Math.round(sim.base().interesTotal)).toBeGreaterThan(sim.escenario().interesTotal);
    // cuota que necesitaría cada deuda para liquidar en la fecha sin deudas elegida
    expect(sim.cuotaNecesaria()).toBe(
      Math.round(
        sim
          .deudasDelEscenario()
          .reduce((suma, d) => suma + cuotaFija(d.saldo, d.tasaMensual, sim.mesesAlObjetivo()), 0),
      ),
    );
    expect(sim.mesesAlObjetivo()).toBe(24);
    expect(
      sim.planDeAbono().filter((p) => p.tipo === 'abono').some((p) => p.deudaId === idTarjeta),
    ).toBe(true);
  });

  it('guarda y quita escenarios guardados para compararlos', async () => {
    const { sim } = await simuladorListo();
    sim.guardarEscenario('  Agresivo  ');
    expect(sim.escenariosGuardados()).toHaveLength(1);
    expect(sim.escenariosGuardados()[0].nombre).toBe('Agresivo');
    expect(sim.escenariosAComparar().map((e) => e.id)).toEqual(['actual', 'base', sim.escenariosGuardados()[0].id]);
    const json = sim.estado();
    sim.quitarEscenario(sim.escenariosGuardados()[0].id);
    expect(sim.escenariosGuardados()).toHaveLength(0);
    expect((JSON.parse(json) as { escenariosGuardados: unknown[] }).escenariosGuardados).toHaveLength(1);
  });

  it('restablecer borra todo el armado manual del usuario', async () => {
    const { sim } = await simuladorListo();
    sim.abonoMensual.set(900_000);
    sim.recorte.set(30);
    sim.ajustar('persona:p-banco', { saldo: 500_000 });
    sim.alternarDeuda('persona:p-banco', false);
    sim.agregarDeuda();
    sim.agregarEvento('abono');
    sim.compraMonto.set(300_000);
    sim.metaMonto.set(5_000_000);
    sim.inversionAporte.set(100_000);

    sim.restablecer();

    expect(sim.abonoMensual()).toBe(0);
    expect(sim.recorte()).toBe(0);
    expect(sim.ajustes()).toEqual({});
    expect(sim.excluidas().size).toBe(0);
    expect(sim.compraMonto()).toBe(0);
    expect(sim.metaMonto()).toBe(0);
    expect(sim.inversionAporte()).toBe(0);
  });

  it('etiquetar el flujo: los cambios entran y salen del escenario', async () => {
    const { sim } = await simuladorListo();
    sim.agregarCambio('ingreso');
    sim.agregarCambio('gasto');
    const [ingreso, gasto] = sim.cambiosDeFlujo();
    expect(ingreso).toMatchObject({ tipo: 'ingreso', monto: 200_000, desde: 1, hasta: null });
    expect(gasto).toMatchObject({ tipo: 'gasto', monto: 200_000 });
    sim.editarCambio(ingreso.id, { monto: 300_000, desde: 3 });
    expect(sim.cambiosDeFlujo()[0]).toMatchObject({ monto: 300_000, desde: 3 });
    sim.quitarCambio(ingreso.id);
    expect(sim.cambiosDeFlujo()).toHaveLength(1);
  });

  it('restablecer también vuelve el orden de abono a la tasa, como parte del armado del plan', async () => {
    const { sim } = await simuladorListo();
    sim.orden.set('saldo');
    sim.restablecer();
    expect(sim.orden()).toBe('tasa');
  });

  it('al salir y volver a la pantalla el estado se recupera del guardado', async () => {
    const { sim } = await simuladorListo();
    sim.abonoMensual.set(900_000);
    sim.orden.set('saldo');
    sim.recorte.set(30);
    sim.compraMonto.set(700_000);
    sim.compraMes.set(6);
    const guardado = sim.estado();

    sim.restaurar(null);
    expect(sim.abonoMensual()).toBe(0);
    expect(sim.orden()).toBe('tasa');
    expect(sim.compraMonto()).toBe(0);

    sim.restaurar(guardado);
    expect(sim.abonoMensual()).toBe(900_000);
    expect(sim.orden()).toBe('saldo');
    expect(sim.recorte()).toBe(30);
    expect(sim.compraMonto()).toBe(700_000);
    expect(sim.compraMes()).toBe(6);
  });

  it('un guardado que no se entiende deja el simulador limpio en vez de romperlo', async () => {
    const { sim } = await simuladorListo();
    sim.abonoMensual.set(900_000);
    sim.restaurar('{truncado');
    expect(sim.abonoMensual()).toBe(0);
    expect(sim.escenariosGuardados()).toEqual([]);
  });
});
