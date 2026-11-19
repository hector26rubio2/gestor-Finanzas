import { describe, expect, it } from 'vitest';
import { type Deuda, proyectar } from './amortizacion';
import { cuotaParaTerminarEn, proyectarInversion } from './escenarios';

const flujo = { ingresoMensual: 5_000_000, gastoMensual: 3_000_000, recorteDeGasto: 0, metaDeAhorro: 0 };

const CREDITO: Deuda = {
  id: 'c',
  nombre: 'Crédito',
  tipo: 'credito',
  saldo: 1_000_000,
  tasaMensual: 2,
  cuotas: 12,
};

const CUOTA_A_MANO = 94_559.6;

describe('simulador: un crédito de 1.000.000 al 2 % mensual en 12 cuotas, calculado a mano', () => {
  it('la cuota fija es 20.000 / (1 − 1,02^−12) = 94.559,60', () => {
    const resultado = proyectar([CREDITO], [], flujo, 24);

    expect(resultado.cuotaTotal[0]).toBeCloseTo(CUOTA_A_MANO, 0);
    expect(resultado.cuotaTotal[11]).toBeCloseTo(CUOTA_A_MANO, 0);
    expect(resultado.cuotaTotal[12]).toBe(0);
  });

  it('el primer mes: interés 20.000, capital 74.559,60 y saldo 925.440,40', () => {
    const [serie] = proyectar([CREDITO], [], flujo, 24).deudas;

    expect(serie.interes[0]).toBeCloseTo(20_000, 0);
    expect(serie.capital[0]).toBeCloseTo(74_559.6, 0);
    expect(serie.saldo[0]).toBeCloseTo(925_440.4, 0);
  });

  it('el segundo mes: interés 18.508,81 (2 % de 925.440,40) y saldo 849.389,61', () => {
    const [serie] = proyectar([CREDITO], [], flujo, 24).deudas;

    expect(serie.interes[1]).toBeCloseTo(18_508.81, 0);
    expect(serie.saldo[1]).toBeCloseTo(849_389.61, 0);
  });

  it('se salda en el mes 12 y el interés total es 12 × 94.559,60 − 1.000.000 = 134.715,20', () => {
    const resultado = proyectar([CREDITO], [], flujo, 24);
    const [serie] = resultado.deudas;

    expect(serie.mesFinal).toBe(11);
    expect(serie.saldo[11]).toBe(0);
    expect(resultado.mesSinDeudas).toBe(11);
    expect(resultado.interesTotal).toBeCloseTo(134_715.2, 0);
  });

  it('los intereses más el capital de cada mes dan la cuota, y el capital suma lo prestado', () => {
    const [serie] = proyectar([CREDITO], [], flujo, 24).deudas;

    for (let mes = 0; mes < 12; mes++) expect(serie.interes[mes] + serie.capital[mes]).toBeCloseTo(CUOTA_A_MANO, 0);
    const capitalTotal = serie.capital.slice(0, 12).reduce((suma, valor) => suma + valor, 0);
    expect(capitalTotal).toBeCloseTo(1_000_000, 0);
  });

  it('el flujo libre del primer mes es 5.000.000 − 3.000.000 − 94.559,60 = 1.905.440,40', () => {
    const resultado = proyectar([CREDITO], [], flujo, 24);

    expect(resultado.flujoLibre[0]).toBeCloseTo(1_905_440.4, 0);
    expect(resultado.flujoLibre[12]).toBe(2_000_000);
  });

  it('un abono de 500.000 en el mes 3 baja el saldo de ese mes en 500.000', () => {
    const base = proyectar([CREDITO], [], flujo, 24).deudas[0];
    const conAbono = proyectar([CREDITO], [{ tipo: 'abono', id: 'a', deudaId: 'c', mes: 3, monto: 500_000 }], flujo, 24)
      .deudas[0];

    expect(base.saldo[3] - conAbono.saldo[3]).toBeCloseTo(500_000, 0);
    expect(base.saldo[2]).toBeCloseTo(conAbono.saldo[2], 0);
  });

  it('la cuota que hace falta para terminar en 10 meses sin intereses es el saldo entre 10', () => {
    const sinInteres = [{ ...CREDITO, tasaMensual: 0, cuotas: 24 }];

    expect(cuotaParaTerminarEn(sinInteres, 10)).toBe(100_000);
  });
});

describe('simulador: ahorro, compras e inversión, calculados a mano', () => {
  it('ahorrando 2.000.000 al mes, una meta de 10.000.000 se alcanza en el quinto mes', () => {
    const resultado = proyectar([], [], { ...flujo, metaDeAhorro: 10_000_000 }, 12);

    expect(resultado.ahorroAcumulado.slice(0, 5)).toEqual([2_000_000, 4_000_000, 6_000_000, 8_000_000, 10_000_000]);
    expect(resultado.mesDeMeta).toBe(4);
  });

  it('con 3.000.000 ahorrados de entrada la meta llega antes: 5, 7, 9 y 11 millones, en el mes 3', () => {
    const resultado = proyectar([], [], { ...flujo, metaDeAhorro: 10_000_000, ahorroInicial: 3_000_000 }, 12);

    expect(resultado.ahorroAcumulado.slice(0, 4)).toEqual([5_000_000, 7_000_000, 9_000_000, 11_000_000]);
    expect(resultado.mesDeMeta).toBe(3);
  });

  it('una compra de 1.200.000 en 12 cuotas sin interés suma 100.000 a la cuota desde su mes', () => {
    const resultado = proyectar(
      [],
      [{ tipo: 'compra', id: 'n', nombre: 'Portátil', mes: 3, monto: 1_200_000, cuotas: 12, tasaMensual: 0 }],
      flujo,
      24,
    );

    expect(resultado.cuotaTotal[2]).toBe(0);
    expect(resultado.cuotaTotal[3]).toBeCloseTo(100_000, 0);
    expect(resultado.cuotaTotal[14]).toBeCloseTo(100_000, 0);
    expect(resultado.cuotaTotal[15]).toBe(0);
    expect(resultado.interesTotal).toBeCloseTo(0, 0);
  });

  it('una inversión de 1.000.000 con aporte de 100.000 al mes y sin rendimiento llega a 2.200.000 en 12 meses', () => {
    const resultado = proyectarInversion(1_000_000, 100_000, 0, 12);

    expect(resultado.valorFinal).toBe(2_200_000);
    expect(resultado.rendimiento).toBe(0);
  });

  it('1.000.000 al 12 % anual efectivo, sin aportes, valen 1.254.400 a los 24 meses', () => {
    const resultado = proyectarInversion(1_000_000, 0, 12, 24);

    expect(resultado.valorFinal).toBeCloseTo(1_254_400, -1);
    expect(resultado.rendimiento).toBeCloseTo(254_400, -1);
  });
});
