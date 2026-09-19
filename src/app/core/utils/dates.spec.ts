import { describe, expect, it } from 'vitest';
import { addMonthsToIso, formatDateTime, todayIso } from './dates';

describe('fechas', () => {
  it('hoy se escribe con la fecha local, sin desfase de zona horaria', () => {
    expect(todayIso(new Date(2026, 8, 21, 23, 30))).toBe('2026-09-21');
  });

  it('sumar meses respeta el último día del mes', () => {
    expect(addMonthsToIso('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonthsToIso('2026-08-31', 12)).toBe('2027-08-31');
    expect(addMonthsToIso('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('el formato sigue el idioma pedido', () => {
    const date = new Date(2026, 11, 31, 19, 0);
    expect(formatDateTime(date, 'es-CO')).toContain('dic');
    expect(formatDateTime(date, 'en-US')).toContain('Dec');
  });

  it('un valor vacío o inválido no rompe la vista', () => {
    expect(formatDateTime(null, 'es-CO')).toBe('');
    expect(formatDateTime('no es fecha', 'es-CO')).toBe('');
  });
});
