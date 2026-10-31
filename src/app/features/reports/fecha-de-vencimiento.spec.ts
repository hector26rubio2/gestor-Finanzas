import { describe, expect, it } from 'vitest';
import { fechaDeVencimiento } from './fecha-de-vencimiento';

describe('fechaDeVencimiento', () => {
  it('muestra el día calendario sin importar la zona horaria', () => {
    const esperada = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date('2026-11-05T12:00:00Z'),
    );
    expect(fechaDeVencimiento('2026-11-05', 'es-CO')).toBe(esperada);
    expect(fechaDeVencimiento('2026-11-05', 'es-CO')).toContain('5');
  });

  it('no retrocede al día anterior en el límite del día', () => {
    expect(fechaDeVencimiento('2026-01-01', 'es-CO')).toContain('1');
    expect(fechaDeVencimiento('2026-01-01', 'es-CO')).toMatch(/ene/i);
  });
});
