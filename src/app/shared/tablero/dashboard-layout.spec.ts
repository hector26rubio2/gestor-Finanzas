import { describe, expect, it } from 'vitest';
import {
  FlowDefault,
  FlowItem,
  clampCols,
  clampHeight,
  colsFromWidth,
  moveItem,
  rowSpan,
  reconcileFlow,
  swapAdjacent,
  withCols,
  withHeight,
} from './dashboard-layout';

const base = (id: string, cols = 6, height = 360): FlowDefault => ({ id, cols, height });
const ids = (items: readonly FlowItem[]) => items.map((item) => item.id);

describe('diseño del dashboard en cuadrícula de 12 columnas', () => {
  it('con un diseño vacío parte de los valores por defecto', () => {
    const items = reconcileFlow([], [base('a'), base('b', 12, 520)]);
    expect(items).toEqual([base('a'), base('b', 12, 520)]);
  });

  it('el ancho se acota entre el mínimo y las doce columnas', () => {
    expect(clampCols(0)).toBe(2);
    expect(clampCols(20)).toBe(12);
    expect(clampCols(4.4)).toBe(4);
    expect(clampCols(1, 1)).toBe(1);
  });

  it('el alto se acota y se ajusta a pasos de diez', () => {
    expect(clampHeight(10)).toBe(100);
    expect(clampHeight(5000)).toBe(1100);
    expect(clampHeight(437)).toBe(440);
  });

  it('achicar un elemento no toca a los demás', () => {
    const items = reconcileFlow([], [base('a'), base('b'), base('c')]);
    const next = withCols(items, 'a', 4);
    expect(next.map((item) => item.cols)).toEqual([4, 6, 6]);
    expect(next[1]).toBe(items[1]);
  });

  it('cambiar el alto solo afecta al elemento pedido', () => {
    const items = reconcileFlow([], [base('a'), base('b')]);
    expect(withHeight(items, 'b', 600).map((item) => item.height)).toEqual([360, 600]);
  });

  it('mover reordena y respeta los límites', () => {
    const items = reconcileFlow([], [base('a'), base('b'), base('c')]);
    expect(ids(moveItem(items, 0, 2))).toEqual(['b', 'c', 'a']);
    expect(moveItem(items, 0, 9)).toBe(items);
    expect(ids(swapAdjacent(items, 'b', -1))).toEqual(['b', 'a', 'c']);
    expect(swapAdjacent(items, 'a', -1)).toBe(items);
  });

  it('al reconciliar quita lo que ya no existe, conserva el orden y añade lo nuevo al final', () => {
    const items = withCols(reconcileFlow([], [base('a'), base('b'), base('c')]), 'c', 3);
    const next = reconcileFlow(items, [base('c'), base('a'), base('d', 12)]);
    expect(ids(next)).toEqual(['a', 'c', 'd']);
    expect(next[1].cols).toBe(3);
    expect(next[2].cols).toBe(12);
  });

  it('sin cambios devuelve el mismo diseño', () => {
    const items = reconcileFlow([], [base('a'), base('b')]);
    expect(reconcileFlow(items, [base('a'), base('b')])).toBe(items);
  });

  it('cambiar a un valor igual devuelve el mismo diseño', () => {
    const items = reconcileFlow([], [base('a'), base('b')]);
    expect(withCols(items, 'a', 6)).toBe(items);
    expect(withHeight(items, 'a', 360)).toBe(items);
    expect(withCols(items, 'zzz', 4)).toBe(items);
  });

  it('calcula las filas de la cuadrícula incluyendo el espacio entre ítems', () => {
    expect(rowSpan(360)).toBe(38);
    expect(rowSpan(100)).toBe(12);
  });

  it('convierte un ancho en píxeles a columnas de la cuadrícula', () => {
    expect(colsFromWidth(568, 1160, 16)).toBeCloseTo(6, 0);
    expect(colsFromWidth(1160, 1160, 16)).toBeCloseTo(12, 0);
  });
});
