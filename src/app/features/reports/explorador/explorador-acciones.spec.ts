import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Movement } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { ExploradorDeReportesComponent } from './explorador';

const PROVEEDORES: Provider[] = [provideRouter([]) as unknown as Provider];
const PAGINA_VACIA = { items: [], page: 1, size: 100, total: 0, totalPages: 0, hasNext: false };

const movimiento = (id: string, parcial: Partial<Movement>): Movement =>
  ({
    id,
    date: '2026-11-10',
    description: id,
    accountId: 'a1',
    category: 'Mercado',
    kind: 'expense',
    effect: 'expense',
    amount: -100,
    status: 'confirmed',
    ...parcial,
  }) as Movement;

function montar(movimientos: Movement[] = []) {
  const transport = new TransportFalso()
    .responder('POST /api/v1/movements/search', () => ({ body: { ...PAGINA_VACIA } }))
    .responder('GET /api/v1/reports/saved', { body: [] });
  const montado = pruebaRender(ExploradorDeReportesComponent, {
    session: sesionDe(),
    data: datosDe({ movements: movimientos }),
    transport,
    providers: PROVEEDORES,
  });
  montado.cambios();
  return montado.component;
}

beforeEach(() => localStorage.clear());

const ids = (componente: ExploradorDeReportesComponent) => componente.vistas().map((vista) => vista.id);

describe('explorador de reportes: acciones sobre las gráficas', () => {
  it('arranca con las seis gráficas iniciales', () => {
    const componente = montar();

    expect(ids(componente)).toEqual([
      'inicial-flujo',
      'inicial-sankey',
      'inicial-sol',
      'inicial-calendario',
      'inicial-cajas',
      'inicial-matriz',
    ]);
  });

  it('quitar una gráfica la saca de la lista y deja las demás en su orden', () => {
    const componente = montar();

    componente.quitarVista('inicial-sol');

    expect(ids(componente)).toEqual([
      'inicial-flujo',
      'inicial-sankey',
      'inicial-calendario',
      'inicial-cajas',
      'inicial-matriz',
    ]);
  });

  it('restaurar devuelve las gráficas iniciales después de quitar y duplicar', () => {
    const componente = montar();
    componente.quitarVista('inicial-flujo');
    componente.duplicarVista(componente.vistas()[0]);

    componente.restaurar();

    expect(ids(componente)).toHaveLength(6);
    expect(ids(componente)[0]).toBe('inicial-flujo');
  });

  it('duplicar agrega una copia al final con otro id y «(2)» en el título, sin tocar el original', () => {
    const componente = montar();
    const original = componente.vistas()[1];

    componente.duplicarVista(original);

    const copia = componente.vistas().at(-1)!;
    expect(componente.vistas()).toHaveLength(7);
    expect(copia.id).not.toBe(original.id);
    expect(copia.title).toBe(`${original.title} (2)`);
    expect(copia.config).toEqual(original.config);
    expect(componente.vistas()[1].id).toBe(original.id);
  });

  it('mover una gráfica la intercambia con su vecina', () => {
    const componente = montar();

    componente.moverVista('inicial-sankey', -1);
    expect(ids(componente).slice(0, 2)).toEqual(['inicial-sankey', 'inicial-flujo']);

    componente.moverVista('inicial-sankey', 1);
    expect(ids(componente).slice(0, 2)).toEqual(['inicial-flujo', 'inicial-sankey']);
  });

  it('mover la primera hacia arriba o la última hacia abajo no hace nada', () => {
    const componente = montar();
    const antes = ids(componente);

    componente.moverVista(antes[0], -1);
    componente.moverVista(antes.at(-1)!, 1);
    componente.moverVista('no-existe', 1);

    expect(ids(componente)).toEqual(antes);
  });

  it('guardar una gráfica existente la reemplaza en su lugar y cierra el editor', () => {
    const componente = montar();
    componente.editando.set(componente.vistas()[2]);

    componente.guardarVista({ ...componente.vistas()[2], title: 'Mi sol', wide: true });

    expect(ids(componente)).toHaveLength(6);
    expect(componente.vistas()[2]).toMatchObject({ id: 'inicial-sol', title: 'Mi sol', wide: true });
    expect(componente.editando()).toBeUndefined();
  });

  it('guardar una gráfica nueva la agrega al final', () => {
    const componente = montar();

    componente.guardarVista({
      id: 'nueva',
      title: 'Gasto por categoría',
      config: { tipo: 'pie', dimension: 'category', measure: 'expense' },
      wide: false,
    } as never);

    expect(ids(componente)).toHaveLength(7);
    expect(componente.vistas().at(-1)!.id).toBe('nueva');
  });

  it('alternar el ancho cambia solo esa gráfica', () => {
    const componente = montar();
    const antes = componente.vistas()[1].wide;

    componente.alternarAncho(componente.vistas()[1]);

    expect(componente.vistas()[1].wide).toBe(!antes);
    expect(componente.vistas()[0].wide).toBe(true);
  });
});

describe('explorador de reportes: filtros de datos', () => {
  const datos = [
    movimiento('ingreso', { kind: 'income', effect: 'income', amount: 1000, accountId: 'a1', category: 'Salario' }),
    movimiento('super', { amount: -300, accountId: 'a1', category: 'Mercado' }),
    movimiento('cine', { amount: -50, accountId: 'a2', category: 'Ocio' }),
    movimiento('cena', { amount: -80, accountId: 'a2', category: 'Mercado' }),
  ];

  it('cada filtro reduce los movimientos graficados', () => {
    const componente = montar(datos);
    expect(componente.movimientos()).toHaveLength(4);

    componente.cuenta.set('a2');
    expect(
      componente
        .movimientos()
        .map((m) => m.id)
        .sort(),
    ).toEqual(['cena', 'cine']);

    componente.cuenta.set('all');
    componente.categoria.set('Mercado');
    expect(
      componente
        .movimientos()
        .map((m) => m.id)
        .sort(),
    ).toEqual(['cena', 'super']);
  });

  it('entra y sale separan ingresos de gastos', () => {
    const componente = montar(datos);

    componente.flujo.set('in');
    expect(componente.movimientos().map((m) => m.id)).toEqual(['ingreso']);

    componente.flujo.set('out');
    expect(componente.movimientos()).toHaveLength(3);
  });

  it('los filtros se combinan y al quitarlos todo vuelve', () => {
    const componente = montar(datos);

    componente.cuenta.set('a2');
    componente.categoria.set('Mercado');
    componente.flujo.set('out');
    expect(componente.movimientos().map((m) => m.id)).toEqual(['cena']);

    componente.cuenta.set('all');
    componente.categoria.set('all');
    componente.flujo.set('all');
    expect(componente.movimientos()).toHaveLength(4);
  });

  it('el estado guardado del reporte recuerda los filtros elegidos', () => {
    const componente = montar(datos);
    componente.cuenta.set('a2');
    componente.categoria.set('Ocio');
    componente.flujo.set('out');

    const estado = JSON.parse(componente.estado());

    expect(estado).toMatchObject({ version: 1, cuenta: 'a2', categoria: 'Ocio', flujo: 'out' });
  });

  it('cargar un reporte guardado restaura el período, los filtros y las gráficas', () => {
    const componente = montar(datos);
    const reporte = JSON.stringify({
      version: 1,
      preset: 'custom',
      desde: '2026-01-01',
      hasta: '2026-03-31',
      cuenta: 'a1',
      categoria: 'Salario',
      flujo: 'in',
      vistas: [
        {
          id: 'v1',
          title: 'Solo ingresos',
          config: { tipo: 'pie', dimension: 'category', measure: 'income' },
          wide: false,
        },
      ],
    });

    componente.cargarReporte(reporte);

    expect(componente.preset()).toBe('custom');
    expect(componente.rango()).toEqual({ start: '2026-01-01', end: '2026-03-31' });
    expect([componente.cuenta(), componente.categoria(), componente.flujo()]).toEqual(['a1', 'Salario', 'in']);
    expect(ids(componente)).toEqual(['v1']);
  });

  it('cargar «nada» vuelve a los valores por defecto', () => {
    const componente = montar(datos);
    componente.cuenta.set('a2');
    componente.flujo.set('out');

    componente.cargarReporte(null);

    expect(componente.preset()).toBe('last6');
    expect([componente.cuenta(), componente.categoria(), componente.flujo()]).toEqual(['all', 'all', 'all']);
  });
});

describe('explorador de reportes: rango de fechas', () => {
  it('un rango personalizado con las fechas invertidas se ordena solo', () => {
    const componente = montar();
    componente.preset.set('custom');

    componente.desde.set('2026-06-30');
    componente.hasta.set('2026-06-01');

    expect(componente.rango()).toEqual({ start: '2026-06-01', end: '2026-06-30' });
  });

  it('cambiar de período cambia el rango, y moverlo desplaza el ancla', () => {
    const componente = montar();
    componente.preset.set('month');
    const antes = componente.rango();

    componente.moverAncla(-1);

    expect(componente.rango().start < antes.start).toBe(true);
  });
});
