import { describe, expect, it } from 'vitest';
import { MovementKind } from '@core/utils/movement-kinds';
import { efectoEnElDisponible, inicioDeLaProyeccion, saldosProyectados } from './saldo-proyectado';

describe('efecto de un recurrente en el disponible', () => {
  it('un ingreso suma y un gasto resta', () => {
    expect(efectoEnElDisponible(MovementKind.income, 1000)).toBe(1000);
    expect(efectoEnElDisponible(MovementKind.expense, 1000)).toBe(-1000);
  });

  it('una compra con tarjeta no toca el disponible: sube la deuda', () => {
    expect(efectoEnElDisponible(MovementKind.cardPurchase, 1000)).toBe(0);
  });

  it('una transferencia entre cuentas propias no cambia el disponible', () => {
    expect(efectoEnElDisponible(null, 1000)).toBe(0);
  });
});

describe('saldo proyectado día a día', () => {
  const dias = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];
  const eventos = [
    { fecha: '2026-11-10', monto: -300_000 },
    { fecha: '2026-11-10', monto: -50_000 },
    { fecha: '2026-11-12', monto: 2_000_000 },
  ];

  it('hoy muestra el disponible real y cada día siguiente acumula lo previsto', () => {
    const saldos = saldosProyectados({ hoy: '2026-11-09', disponibleHoy: 1_000_000, eventos, dias });

    expect(saldos.get('2026-11-09')).toBe(1_000_000);
    expect(saldos.get('2026-11-10')).toBe(650_000);
    expect(saldos.get('2026-11-11')).toBe(650_000);
    expect(saldos.get('2026-11-12')).toBe(2_650_000);
  });

  it('los días pasados no llevan proyección', () => {
    const saldos = saldosProyectados({ hoy: '2026-11-09', disponibleHoy: 1_000_000, eventos, dias });

    expect(saldos.has('2026-11-08')).toBe(false);
  });

  it('cuenta lo previsto entre hoy y el primer día visible aunque ese tramo no se vea', () => {
    const saldos = saldosProyectados({
      hoy: '2026-11-09',
      disponibleHoy: 1_000_000,
      eventos,
      dias: ['2026-11-20', '2026-11-21'],
    });

    expect(saldos.get('2026-11-20')).toBe(2_650_000);
  });

  it('lo previsto para hoy o antes no se descuenta otra vez', () => {
    const saldos = saldosProyectados({
      hoy: '2026-11-10',
      disponibleHoy: 500_000,
      eventos,
      dias: ['2026-11-10', '2026-11-11'],
    });

    expect(saldos.get('2026-11-10')).toBe(500_000);
    expect(saldos.get('2026-11-11')).toBe(500_000);
  });
});

describe('inicio de la proyección a pedir', () => {
  it('si lo visible ya empezó, se pide desde el inicio visible', () => {
    expect(inicioDeLaProyeccion('2026-11-09', '2026-11-01', '2026-12-31')).toBe('2026-11-01');
  });

  it('si lo visible es futuro, se pide desde hoy para acumular', () => {
    expect(inicioDeLaProyeccion('2026-11-09', '2026-12-01', '2027-01-31')).toBe('2026-11-09');
  });

  it('si desde hoy supera el máximo que acepta la API, se pide solo lo visible', () => {
    expect(inicioDeLaProyeccion('2026-11-09', '2030-01-01', '2030-02-28')).toBe('2030-01-01');
  });
});
