import { describe, expect, it } from 'vitest';
import { agruparPorFecha, grupoDe, haceCuanto } from './notification-dates';

const ahora = new Date(2026, 9, 7, 18, 0);
const local = (dia: number, hora = 12) => new Date(2026, 9, dia, hora, 0).toISOString();

describe('grupoDe', () => {
  it('separa hoy, ayer, esta semana y anteriores por día calendario', () => {
    expect(grupoDe(local(7, 0), ahora)).toBe('today');
    expect(grupoDe(local(6, 23), ahora)).toBe('yesterday');
    expect(grupoDe(local(2), ahora)).toBe('week');
    expect(grupoDe(local(1), ahora)).toBe('week');
    expect(grupoDe(new Date(2026, 8, 30, 12).toISOString(), ahora)).toBe('older');
  });
});

describe('agruparPorFecha', () => {
  it('respeta el orden de los grupos y omite los vacíos', () => {
    const grupos = agruparPorFecha(
      [{ createdAt: local(2) }, { createdAt: local(7) }, { createdAt: local(7, 9) }],
      ahora,
    );
    expect(grupos.map((g) => g.clave)).toEqual(['today', 'week']);
    expect(grupos[0].elementos).toHaveLength(2);
  });
});

describe('haceCuanto', () => {
  it('usa la unidad más grande que cabe', () => {
    expect(haceCuanto(new Date(ahora.getTime() - 5 * 60_000).toISOString(), ahora, 'es')).toBe('hace 5 minutos');
    expect(haceCuanto(new Date(ahora.getTime() - 3 * 3_600_000).toISOString(), ahora, 'es')).toBe('hace 3 horas');
    expect(haceCuanto(new Date(ahora.getTime() - 86_400_000).toISOString(), ahora, 'es')).toBe('ayer');
  });

  it('usa "este minuto" con menos de un minuto', () => {
    expect(haceCuanto(ahora.toISOString(), ahora, 'es')).toBe('este minuto');
  });
});
