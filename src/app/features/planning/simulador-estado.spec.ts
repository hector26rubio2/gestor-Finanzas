import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { AjusteDeLinea, CambioDeFlujo, Deuda, EscenarioGuardado } from '@shared/proyecciones';
import {
  type EstadoGuardado,
  type EventoDelEscenario,
  type SenalesDelSimulador,
  aplicarEstado,
  leerEstado,
  serializarEstado,
} from './simulador-estado';

const senales = (): SenalesDelSimulador => ({
  recorte: signal(0),
  ajustesDeLinea: signal<Record<string, AjusteDeLinea>>({}),
  recurrentesQuitados: signal(new Set<string>()),
  cambiosDeFlujo: signal<readonly CambioDeFlujo[]>([]),
  vista: signal('original'),
  medidaDeComparacion: signal('saldoTotal'),
  escenariosGuardados: signal<readonly EscenarioGuardado[]>([]),
  ajustes: signal<Record<string, Partial<Pick<Deuda, 'saldo' | 'tasaMensual' | 'cuotas'>>>>({}),
  excluidas: signal(new Set<string>()),
  hipoteticas: signal<readonly Deuda[]>([]),
  abonoMensual: signal(0),
  orden: signal('tasa'),
  eventos: signal<readonly EventoDelEscenario[]>([]),
  fechaSinDeudas: signal('2028-10-22'),
  compraMonto: signal(0),
  compraNombre: signal(''),
  compraCuotas: signal(12),
  compraTasa: signal(2.5),
  compraMes: signal(0),
  metaMonto: signal(0),
  metaFecha: signal('2027-10-22'),
  metaAhorroInicial: signal(0),
  inversionInicial: signal(0),
  inversionAporte: signal(0),
  inversionTasa: signal(8),
  inversionFecha: signal('2031-10-22'),
});

const deuda: Deuda = {
  id: 'tarjeta:t1:fees',
  nombre: 'Visa',
  tipo: 'tarjeta',
  saldo: 2_000_000,
  tasaMensual: 2,
  cuotas: 12,
};

describe('serializarEstado / aplicarEstado: estado del simulador', () => {
  it('reproduce el estado al serializar y aplicar en un simulador nuevo', () => {
    const origen = senales();
    origen.recorte.set(20);
    origen.ajustesDeLinea.set({ 'categoria:expense|Mercado': { incluida: false, monto: 45_900 } });
    origen.recurrentesQuitados.set(new Set(['recurrente:r1']));
    origen.cambiosDeFlujo.set([
      { id: 'cambio:1', nombre: 'Extra', tipo: 'ingreso', monto: 200_000, desde: 1, hasta: 6 },
    ]);
    origen.vista.set('barras');
    origen.medidaDeComparacion.set('ahorroAcumulado');
    origen.ajustes.set({ 'persona:p1': { saldo: 500_000 } });
    origen.excluidas.set(new Set(['persona:p1']));
    origen.hipoteticas.set([deuda]);
    origen.abonoMensual.set(750_000);
    origen.orden.set('saldo');
    origen.eventos.set([{ tipo: 'abono', id: 'evento:1', deudaId: deuda.id, mes: 3, monto: 500_000 }]);
    origen.compraMonto.set(1_200_000);
    origen.compraNombre.set('Portátil');
    origen.compraCuotas.set(24);
    origen.compraTasa.set(2.2);
    origen.compraMes.set(4);
    origen.metaMonto.set(3_000_000);
    origen.metaFecha.set('2027-06-01');
    origen.metaAhorroInicial.set(750_000);
    origen.inversionInicial.set(10_000_000);
    origen.inversionAporte.set(300_000);
    origen.inversionTasa.set(9.5);
    origen.inversionFecha.set('2030-01-01');

    const destino = senales();
    const guardado = leerEstado(serializarEstado(origen));
    expect(guardado).not.toBeNull();
    aplicarEstado(destino, guardado!);

    expect(destino.recorte()).toBe(20);
    expect(destino.ajustesDeLinea()).toEqual(origen.ajustesDeLinea());
    expect([...destino.recurrentesQuitados()]).toEqual(['recurrente:r1']);
    expect(destino.cambiosDeFlujo()).toEqual(origen.cambiosDeFlujo());
    expect(destino.vista()).toBe('barras');
    expect(destino.medidaDeComparacion()).toBe('ahorroAcumulado');
    expect(destino.ajustes()).toEqual(origen.ajustes());
    expect([...destino.excluidas()]).toEqual(['persona:p1']);
    expect(destino.hipoteticas()).toEqual([deuda]);
    expect(destino.abonoMensual()).toBe(750_000);
    expect(destino.orden()).toBe('saldo');
    expect(destino.eventos()).toEqual(origen.eventos());
    expect(destino.fechaSinDeudas()).toBe('2028-10-22');
    expect(destino.compraMonto()).toBe(1_200_000);
    expect(destino.compraNombre()).toBe('Portátil');
    expect(destino.compraCuotas()).toBe(24);
    expect(destino.compraTasa()).toBe(2.2);
    expect(destino.compraMes()).toBe(4);
    expect(destino.metaMonto()).toBe(3_000_000);
    expect(destino.metaFecha()).toBe('2027-06-01');
    expect(destino.metaAhorroInicial()).toBe(750_000);
    expect(destino.inversionInicial()).toBe(10_000_000);
    expect(destino.inversionAporte()).toBe(300_000);
    expect(destino.inversionTasa()).toBe(9.5);
    expect(destino.inversionFecha()).toBe('2030-01-01');
  });

  it('deja los valores por defecto cuando el guardado omite campos', () => {
    const destino = senales();
    destino.recorte.set(15);
    destino.abonoMensual.set(100_000);
    aplicarEstado(destino, { version: 1 });

    expect(destino.recorte()).toBe(0);
    expect(destino.ajustesDeLinea()).toEqual({});
    expect(destino.recurrentesQuitados().size).toBe(0);
    expect(destino.cambiosDeFlujo()).toEqual([]);
    expect(destino.vista()).toBe('original');
    expect(destino.medidaDeComparacion()).toBe('saldoTotal');
    expect(destino.escenariosGuardados()).toEqual([]);
    expect(destino.ajustes()).toEqual({});
    expect(destino.excluidas().size).toBe(0);
    expect(destino.hipoteticas()).toEqual([]);
    expect(destino.abonoMensual()).toBe(0);
    expect(destino.orden()).toBe('tasa');
    expect(destino.eventos()).toEqual([]);
    // los campos de tracking solo se tocan si el guardado los trae
    expect(destino.fechaSinDeudas()).toBe('2028-10-22');
  });

  it('restaura la compra, la meta y la inversión con sus omisiones independientes', () => {
    const destino = senales();
    destino.compraMonto.set(500_000);
    destino.metaMonto.set(1_000_000);
    destino.inversionAporte.set(50_000);

    aplicarEstado(destino, { version: 1, compra: { monto: 900_000, nombre: 'Moto', cuotas: 18, tasa: 2.1, mes: 2 } });
    expect(destino.compraMonto()).toBe(900_000);
    expect(destino.compraMes()).toBe(2);
    expect(destino.metaMonto()).toBe(1_000_000);
    expect(destino.inversionAporte()).toBe(50_000);

    aplicarEstado(destino, { version: 1, meta: { monto: 2_000_000, fecha: '2027-12-25' } });
    expect(destino.metaAhorroInicial()).toBe(0);
    expect(destino.compraMonto()).toBe(900_000);
    expect(destino.metaMonto()).toBe(2_000_000);
    expect(destino.metaFecha()).toBe('2027-12-25');
    expect(destino.inversionAporte()).toBe(50_000);

    aplicarEstado(destino, {
      version: 1,
      inversion: { inicial: 5_000_000, aporte: 100_000, tasa: 7, fecha: '2029-01-01' },
    });
    expect(destino.inversionInicial()).toBe(5_000_000);
    expect(destino.compraMonto()).toBe(900_000);
  });
});

describe('leerEstado: entra o no entra a la pantalla con un guardado', () => {
  it('acepta un guardado de versión 1', () => {
    const guardado: EstadoGuardado = { version: 1, abonoMensual: 100_000 };
    expect(leerEstado(JSON.stringify(guardado))).toEqual(guardado);
  });

  it('rechaza lo que no sabe leer', () => {
    expect(leerEstado(null)).toBeNull();
    expect(leerEstado('')).toBeNull();
    expect(leerEstado('no es json')).toBeNull();
    expect(leerEstado('{"version": 99}')).toBeNull();
  });
});
