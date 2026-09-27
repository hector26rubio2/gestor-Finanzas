import { describe, expect, it } from 'vitest';
import { Deuda, cuotaFija, proyectar } from './amortizacion';

const flujo = { ingresoMensual: 5_000_000, gastoMensual: 3_000_000, recorteDeGasto: 0, metaDeAhorro: 0 };
const credito: Deuda = {
  id: 'c',
  nombre: 'Vehículo',
  tipo: 'credito',
  saldo: 12_000_000,
  tasaMensual: 1.5,
  cuotas: 36,
};

describe('proyección de deudas', () => {
  it('amortiza un crédito en su plazo con cuota fija', () => {
    const resultado = proyectar([credito], [], flujo, 48);
    const serie = resultado.deudas[0];
    expect(serie.mesFinal).toBe(35);
    expect(serie.saldo[35]).toBe(0);
    expect(cuotaFija(12_000_000, 1.5, 36)).toBeCloseTo(433_829, 0);
    expect(serie.interesTotal).toBeCloseTo(433_829 * 36 - 12_000_000, -2);
  });

  it('un abono extra acorta el plazo y baja los intereses', () => {
    const base = proyectar([credito], [], flujo, 48);
    const conAbono = proyectar(
      [credito],
      [{ tipo: 'abono', id: 'a', deudaId: 'c', mes: 6, monto: 3_000_000 }],
      flujo,
      48,
    );
    expect(conAbono.deudas[0].mesFinal!).toBeLessThan(base.deudas[0].mesFinal!);
    expect(conAbono.interesTotal).toBeLessThan(base.interesTotal);
  });

  it('una compra nueva a cuotas empieza en su mes y suma a la cuota total', () => {
    const resultado = proyectar(
      [],
      [{ tipo: 'compra', id: 'n', nombre: 'Portátil', mes: 3, monto: 1_200_000, cuotas: 12, tasaMensual: 0 }],
      flujo,
      24,
    );
    expect(resultado.cuotaTotal[2]).toBe(0);
    expect(resultado.cuotaTotal[3]).toBeCloseTo(100_000, 0);
    expect(resultado.deudas[0].mesFinal).toBe(14);
  });

  it('calcula cuándo el ahorro acumulado alcanza la meta', () => {
    const resultado = proyectar([credito], [], { ...flujo, metaDeAhorro: 10_000_000 }, 24);
    expect(resultado.mesDeMeta).not.toBeNull();
    expect(resultado.ahorroAcumulado[resultado.mesDeMeta!]).toBeGreaterThanOrEqual(10_000_000);
  });

  it('subir la tasa sube la cuota desde ese mes', () => {
    const base = proyectar([credito], [], flujo, 12);
    const conTasa = proyectar(
      [credito],
      [{ tipo: 'tasa', id: 't', deudaId: 'c', mes: 4, tasaMensual: 2.5 }],
      flujo,
      12,
    );
    expect(conTasa.cuotaTotal[3]).toBeCloseTo(base.cuotaTotal[3], 0);
    expect(conTasa.cuotaTotal[5]).toBeGreaterThan(base.cuotaTotal[5]);
  });
});
