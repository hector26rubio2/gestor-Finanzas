import { describe, expect, it } from 'vitest';
import { fechasDeTarjeta } from './fechas-de-tarjeta';

const visa = { id: 'visa', name: 'Visa Oro', cutDay: 15, dueDay: 5 };
const master = { id: 'master', name: 'Mastercard', cutDay: 31, dueDay: 30 };

describe('fechas de corte y pago de las tarjetas', () => {
  it('en un mes da el corte y el pago de cada tarjeta en su día', () => {
    const fechas = fechasDeTarjeta([visa], { desde: '2026-11-01', hasta: '2026-11-30' });

    expect(fechas.get('2026-11-05')).toEqual([{ tipo: 'pago', tarjetaId: 'visa', nombre: 'Visa Oro' }]);
    expect(fechas.get('2026-11-15')).toEqual([{ tipo: 'corte', tarjetaId: 'visa', nombre: 'Visa Oro' }]);
    expect(fechas.size).toBe(2);
  });

  it('un día que el mes no tiene cae en el último día del mes', () => {
    const fechas = fechasDeTarjeta([master], { desde: '2026-02-01', hasta: '2026-02-28' });

    expect(fechas.get('2026-02-28')?.map((f) => f.tipo)).toEqual(['corte', 'pago']);
  });

  it('en un rango de varios meses repite cada mes', () => {
    const fechas = fechasDeTarjeta([visa], { desde: '2026-11-10', hasta: '2027-01-10' });

    expect([...fechas.keys()].sort()).toEqual(['2026-11-15', '2026-12-05', '2026-12-15', '2027-01-05']);
  });

  it('varias tarjetas el mismo día comparten la fecha', () => {
    const otra = { id: 'otra', name: 'Otra', cutDay: 15 };
    const fechas = fechasDeTarjeta([visa, otra], { desde: '2026-11-15', hasta: '2026-11-15' });

    expect(fechas.get('2026-11-15')?.map((f) => f.tarjetaId)).toEqual(['visa', 'otra']);
  });

  it('una tarjeta sin días configurados no aporta fechas', () => {
    expect(fechasDeTarjeta([{ id: 'x', name: 'Sin días' }], { desde: '2026-11-01', hasta: '2026-11-30' }).size).toBe(0);
  });
});
