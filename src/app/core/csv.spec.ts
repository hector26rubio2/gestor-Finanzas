import { describe, expect, it } from 'vitest';
import { escapeCsv, toCsv } from './csv';

describe('csv', () => {
  it('deja en paz lo que no necesita comillas', () => {
    expect(escapeCsv('Mercado')).toBe('Mercado');
    expect(escapeCsv(1500)).toBe('1500');
  });

  it('entrecomilla cuando el valor lleva el separador', () => {
    // Sin esto, una descripción con punto y coma parte la fila en dos columnas.
    expect(escapeCsv('Mercado; frutas')).toBe('"Mercado; frutas"');
  });

  it('duplica las comillas internas, como manda RFC 4180', () => {
    expect(escapeCsv('Pago "urgente"')).toBe('"Pago ""urgente"""');
  });

  it('entrecomilla cuando el valor lleva un salto de línea', () => {
    expect(escapeCsv('Dos\nlíneas')).toBe('"Dos\nlíneas"');
  });

  it('trata la ausencia de valor como celda vacía, no como «undefined»', () => {
    expect(escapeCsv(null)).toBe('');
    expect(escapeCsv(undefined)).toBe('');
  });

  it('construye cabecera y filas separadas por CRLF', () => {
    const filas = [
      { mes: 'ago', ingresos: 100, gastos: 40 },
      { mes: 'sep', ingresos: 120, gastos: 55 },
    ];
    const csv = toCsv(filas, [
      { header: 'Mes', value: (fila) => fila.mes },
      { header: 'Ingresos', value: (fila) => fila.ingresos },
      { header: 'Gastos', value: (fila) => fila.gastos },
    ]);

    expect(csv.split('\r\n')).toEqual(['Mes;Ingresos;Gastos', 'ago;100;40', 'sep;120;55']);
  });

  it('un conjunto vacío deja solo la cabecera', () => {
    expect(toCsv([], [{ header: 'Mes', value: () => '' }])).toBe('Mes');
  });

  it('respeta un separador distinto', () => {
    const csv = toCsv([{ a: 'x,y' }], [{ header: 'A', value: (fila) => fila.a }], ',');
    expect(csv).toBe('A\r\n"x,y"');
  });
});
