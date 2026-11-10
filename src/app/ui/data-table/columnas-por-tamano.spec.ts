import { describe, expect, it } from 'vitest';
import { claveOcultaPorPrioridad } from './data-table.model';
import { TableColumn } from './data-table.model';

const columnas: TableColumn[] = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'importe', label: 'Importe', prioridad: 1 },
  { key: 'moneda', label: 'Moneda', prioridad: 2 },
  { key: 'nota', label: 'Nota', prioridad: 3 },
];

describe('columnas ocultas por prioridad', () => {
  it('en medio y amplio solo quedan las de prioridad 1, y la omitida cuenta como 1', () => {
    for (const tamano of ['medio', 'amplio'] as const)
      expect(columnas.filter((c) => claveOcultaPorPrioridad(c, tamano)).map((c) => c.key)).toEqual(['moneda', 'nota']);
  });

  it('en expandido no se oculta ninguna', () => {
    expect(columnas.some((c) => claveOcultaPorPrioridad(c, 'expandido'))).toBe(false);
  });

  it('en compacto no se oculta ninguna por prioridad', () => {
    expect(columnas.some((c) => claveOcultaPorPrioridad(c, 'compacto'))).toBe(false);
  });

  it('una tabla sin prioridades no cambia en ningún tamaño', () => {
    const sinPrioridad: TableColumn[] = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ];
    for (const tamano of ['compacto', 'medio', 'amplio', 'expandido'] as const)
      expect(sinPrioridad.some((c) => claveOcultaPorPrioridad(c, tamano))).toBe(false);
  });
});
