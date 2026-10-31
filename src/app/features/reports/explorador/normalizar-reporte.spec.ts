import { describe, expect, it } from 'vitest';
import { normalizarReporte } from './normalizar-reporte';

const hoy = '2026-10-05';
const vista = (id: string, tipo: string) => ({ id, title: 'v', config: { tipo }, wide: true });
const json = (campos: Record<string, unknown>) => JSON.stringify({ version: 1, preset: 'last3', ...campos });

describe('normalizarReporte', () => {
  it('sin json devuelve el explorador libre sin aviso', () => {
    expect(normalizarReporte(null, hoy)).toEqual({ reporte: null, reconocido: true });
  });

  it('json roto o version desconocida avisa', () => {
    expect(normalizarReporte('{no', hoy)).toEqual({ reporte: null, reconocido: false });
    expect(normalizarReporte(JSON.stringify({ version: 2 }), hoy)).toEqual({ reporte: null, reconocido: false });
  });

  it('completa con el preset por defecto las fechas que faltan', () => {
    const { reporte } = normalizarReporte(json({ preset: 'custom' }), hoy);
    expect(reporte?.desde).toBe('2026-05-01');
    expect(reporte?.hasta).toBe('2026-10-31');
  });

  it('ordena desde y hasta cuando vienen invertidos', () => {
    const { reporte } = normalizarReporte(json({ preset: 'custom', desde: '2026-09-30', hasta: '2026-09-01' }), hoy);
    expect(reporte?.desde).toBe('2026-09-01');
    expect(reporte?.hasta).toBe('2026-09-30');
  });

  it('descarta las vistas con tipo desconocido', () => {
    const { reporte } = normalizarReporte(json({ vistas: [vista('a', 'bar'), vista('b', 'inventado')] }), hoy);
    expect(reporte?.vistas.map((v) => v.id)).toEqual(['a']);
  });

  it('un preset desconocido vuelve al por defecto', () => {
    expect(normalizarReporte(json({ preset: 'nada' }), hoy).reporte?.preset).toBe('last6');
  });

  it('ignora fechas con formato invalido', () => {
    const { reporte } = normalizarReporte(json({ preset: 'custom', desde: 'ayer', hasta: 5 }), hoy);
    expect(reporte?.desde).toBe('2026-05-01');
    expect(reporte?.hasta).toBe('2026-10-31');
  });
});
