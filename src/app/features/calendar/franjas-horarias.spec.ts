import { describe, expect, it } from 'vitest';
import { franjasDelDia, horaLocalDe, horasVisibles } from './franjas-horarias';

const local = (anio: number, mes: number, dia: number, hora: number, minuto = 0) =>
  new Date(anio, mes - 1, dia, hora, minuto).toISOString();

describe('hora local de un movimiento', () => {
  it('usa la hora de registro cuando se registró el mismo día de su fecha', () => {
    expect(horaLocalDe({ date: '2026-11-12', registradoEl: local(2026, 11, 12, 14, 35) })).toBe(14);
  });

  it('no tiene hora si se registró otro día', () => {
    expect(horaLocalDe({ date: '2026-11-10', registradoEl: local(2026, 11, 12, 9) })).toBeNull();
  });

  it('no tiene hora si no se conoce cuándo se registró', () => {
    expect(horaLocalDe({ date: '2026-11-12' })).toBeNull();
    expect(horaLocalDe({ date: '2026-11-12', registradoEl: 'no-es-fecha' })).toBeNull();
  });
});

describe('franjas de un día', () => {
  const movimientos = [
    { id: 'a', date: '2026-11-12', registradoEl: local(2026, 11, 12, 9, 10) },
    { id: 'b', date: '2026-11-12', registradoEl: local(2026, 11, 12, 9, 50) },
    { id: 'c', date: '2026-11-12', registradoEl: local(2026, 11, 12, 18) },
    { id: 'd', date: '2026-11-12', registradoEl: local(2026, 11, 20, 8) },
    { id: 'e', date: '2026-11-12' },
  ];

  it('agrupa por hora y deja aparte los que no tienen hora', () => {
    const franjas = franjasDelDia(movimientos);

    expect(franjas.sinHora.map((m) => m.id)).toEqual(['d', 'e']);
    expect(franjas.porHora.get(9)?.map((m) => m.id)).toEqual(['a', 'b']);
    expect(franjas.porHora.get(18)?.map((m) => m.id)).toEqual(['c']);
    expect(franjas.porHora.get(10)).toBeUndefined();
  });
});

describe('horas visibles', () => {
  it('sin movimientos con hora muestra la jornada de 7 a 20', () => {
    expect(horasVisibles([])).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('se amplía para incluir lo más temprano y lo más tardío', () => {
    const horas = horasVisibles([5, 22, 9]);
    expect(horas[0]).toBe(5);
    expect(horas.at(-1)).toBe(22);
    expect(horas).toHaveLength(18);
  });
});
