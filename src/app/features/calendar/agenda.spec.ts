import { describe, expect, it } from 'vitest';
import { ordenarAgenda } from './agenda';

const entrada = (tipo: 'recurrente' | 'vencimiento' | 'movimiento', fecha: string, id: string) => ({ tipo, fecha, id });

describe('orden de los próximos compromisos', () => {
  it('mezcla recurrentes, vencimientos de tarjeta y movimientos por fecha', () => {
    const ordenada = ordenarAgenda([
      entrada('recurrente', '2026-12-20', 'arriendo'),
      entrada('vencimiento', '2026-12-05', 'visa'),
      entrada('movimiento', '2026-12-12', 'cuota'),
      entrada('recurrente', '2026-12-01', 'gimnasio'),
    ]);

    expect(ordenada.map((item) => item.id)).toEqual(['gimnasio', 'visa', 'cuota', 'arriendo']);
  });

  it('el mismo día respeta el orden recurrente, vencimiento, movimiento', () => {
    const ordenada = ordenarAgenda([
      entrada('movimiento', '2026-12-05', 'cuota'),
      entrada('vencimiento', '2026-12-05', 'visa'),
      entrada('recurrente', '2026-12-05', 'gimnasio'),
    ]);

    expect(ordenada.map((item) => item.id)).toEqual(['gimnasio', 'visa', 'cuota']);
  });

  it('no altera la lista original y conserva el orden entre iguales', () => {
    const original = [entrada('recurrente', '2026-12-05', 'a'), entrada('recurrente', '2026-12-05', 'b')];
    const copia = [...original];

    expect(ordenarAgenda(original).map((item) => item.id)).toEqual(['a', 'b']);
    expect(original).toEqual(copia);
  });

  it('sin compromisos devuelve una lista vacía', () => {
    expect(ordenarAgenda([])).toEqual([]);
  });
});
