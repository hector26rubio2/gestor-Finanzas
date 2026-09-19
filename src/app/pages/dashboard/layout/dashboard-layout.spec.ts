import { describe, expect, it } from 'vitest';
import {
  LayoutItem,
  buildRows,
  canJoinPrevious,
  canSplit,
  clampHeight,
  joinPreviousRow,
  reconcileRows,
  splitOut,
  swapAdjacent,
  withHeight,
  withSizes,
} from './dashboard-layout';

const item = (id: string, height = 360, alone = false): LayoutItem => ({ id, height, alone });
const idsOf = (rows: readonly { ids: readonly string[] }[]) => rows.map((row) => row.ids.join('+'));

describe('diseño del dashboard', () => {
  it('reparte los elementos en filas del tamaño pedido y deja solos los anchos', () => {
    const rows = buildRows([item('a'), item('b'), item('c'), item('d', 520, true), item('e')], 2);
    expect(idsOf(rows)).toEqual(['a+b', 'c', 'd', 'e']);
    expect(rows[0].sizes).toEqual([50, 50]);
    expect(rows[2].height).toBe(520);
  });

  it('cada fila suma siempre cien', () => {
    const rows = withSizes(buildRows([item('a'), item('b'), item('c')], 3), 'a', [20, 30, 70]);
    expect(rows[0].sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(100);
  });

  it('acota la altura de una fila', () => {
    expect(clampHeight(10)).toBe(120);
    expect(clampHeight(5000)).toBe(1100);
    expect(clampHeight(437)).toBe(440);
    expect(withHeight(buildRows([item('a')], 2), 'a', 900)[0].height).toBe(900);
  });

  it('unir con la fila anterior reparte el ancho y no deja filas vacías', () => {
    const rows = joinPreviousRow(buildRows([item('a'), item('b'), item('c')], 1), 'b');
    expect(idsOf(rows)).toEqual(['a+b', 'c']);
    expect(rows[0].sizes[0]).toBeCloseTo(50);
    expect(canJoinPrevious(rows, 'a')).toBe(false);
    expect(canJoinPrevious(rows, 'c')).toBe(true);
  });

  it('sacar un elemento de su fila lo deja en una fila propia', () => {
    const rows = splitOut(buildRows([item('a'), item('b')], 2), 'b');
    expect(idsOf(rows)).toEqual(['a', 'b']);
    expect(canSplit(rows, 'a')).toBe(false);
  });

  it('intercambiar con el vecino conserva la forma de las filas', () => {
    const rows = buildRows([item('a'), item('b'), item('c')], 2);
    expect(idsOf(swapAdjacent(rows, 'b', 1))).toEqual(['a+c', 'b']);
    expect(idsOf(swapAdjacent(rows, 'a', -1))).toEqual(['a+b', 'c']);
  });

  it('al reconciliar quita lo que ya no existe y renormaliza la fila', () => {
    const rows = buildRows([item('a'), item('b')], 2);
    const next = reconcileRows(withSizes(rows, 'a', [70, 30]), [item('b')], 2);
    expect(idsOf(next)).toEqual(['b']);
    expect(next[0].sizes).toEqual([100]);
  });

  it('al reconciliar añade lo nuevo a la última fila con hueco', () => {
    const rows = buildRows([item('a'), item('b'), item('c')], 2);
    const next = reconcileRows(rows, [item('a'), item('b'), item('c'), item('d')], 2);
    expect(idsOf(next)).toEqual(['a+b', 'c+d']);
    const alone = reconcileRows(rows, [item('a'), item('b'), item('c'), item('e', 500, true)], 2);
    expect(idsOf(alone)).toEqual(['a+b', 'c', 'e']);
  });

  it('sin cambios devuelve las mismas filas', () => {
    const rows = buildRows([item('a'), item('b')], 2);
    expect(reconcileRows(rows, [item('a'), item('b')], 2)).toBe(rows);
  });

  it('con un diseño vacío arma el de partida', () => {
    expect(idsOf(reconcileRows([], [item('a'), item('b'), item('c')], 2))).toEqual(['a+b', 'c']);
  });
});
