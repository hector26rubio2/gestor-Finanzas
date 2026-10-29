import { describe, expect, it, vi } from 'vitest';
import type { AccionDeGuia, Guia, PasoDeGuia } from './catalogo-de-guias';
import { crearSesionDeGuia, type EntornoDelMotor } from './motor-de-guias';

const TIEMPOS = { trasAccion: 40, sinAccion: 10 };

function paso(tour: string, extra: Partial<PasoDeGuia> = {}): PasoDeGuia {
  return { selector: `[data-tour="${tour}"]`, titulo: tour, texto: tour, ...extra };
}

function guia(pasos: PasoDeGuia[], ruta = 'movements'): Guia {
  return { id: 'prueba', categoria: 'c', titulo: 't', resumen: 'r', ruta, pasos };
}

function entornoDePrueba(presentes: Set<string>, extra: Partial<EntornoDelMotor> = {}) {
  const registro: string[] = [];
  const entorno: EntornoDelMotor = {
    seccionActual: () => 'movements',
    navegar: vi.fn(async (ruta: string) => void registro.push(`navegar:${ruta}`)),
    abrirFormulario: vi.fn((accion) => {
      registro.push(`form:${accion.form.kind}`);
      return true;
    }),
    inspeccionar: vi.fn((entidad) => {
      registro.push(`inspeccionar:${entidad}`);
      return true;
    }),
    cerrarFormulario: vi.fn(() => void registro.push('cerrarFormulario')),
    cerrarInspector: vi.fn(() => void registro.push('cerrarInspector')),
    clic: vi.fn((selector: string) => {
      registro.push(`clic:${selector}`);
      return true;
    }),
    escape: vi.fn(() => void registro.push('escape')),
    existe: (selector) => presentes.has(selector),
    esperar: async (selector) => presentes.has(selector),
    ...extra,
  };
  return { entorno, registro };
}

const abrirGasto: AccionDeGuia = { tipo: 'abrirFormulario', form: { kind: 'expense', operationType: 'normal' } };

describe('motor de guías', () => {
  it('ejecuta antes y devuelve el primer paso disponible', async () => {
    const presentes = new Set(['[data-tour="a"]']);
    const { entorno, registro } = entornoDePrueba(presentes);
    const sesion = crearSesionDeGuia(guia([paso('a', { antes: abrirGasto }), paso('b'), paso('c')]), entorno, TIEMPOS);
    expect(await sesion.primero()).toBe(0);
    expect(registro).toEqual(['form:expense']);
  });

  it('navega a la ruta de la guía si la sección actual es otra', async () => {
    const { entorno, registro } = entornoDePrueba(new Set(['[data-tour="a"]']), { seccionActual: () => 'dashboard' });
    await crearSesionDeGuia(guia([paso('a'), paso('b'), paso('c')]), entorno, TIEMPOS).primero();
    expect(registro).toEqual(['navegar:movements']);
  });

  it('espera a que el selector aparezca tras la acción', async () => {
    const presentes = new Set<string>();
    const esperar = vi.fn(async (selector: string) => {
      presentes.add(selector);
      return true;
    });
    const { entorno } = entornoDePrueba(presentes, { esperar });
    const sesion = crearSesionDeGuia(guia([paso('a', { antes: abrirGasto })]), entorno, TIEMPOS);
    expect(await sesion.primero()).toBe(0);
    expect(esperar).toHaveBeenCalledWith('[data-tour="a"]', TIEMPOS.trasAccion);
  });

  it('salta el paso cuyo selector no aparece y sigue con el siguiente', async () => {
    const presentes = new Set(['[data-tour="a"]', '[data-tour="c"]']);
    const { entorno } = entornoDePrueba(presentes);
    const sesion = crearSesionDeGuia(guia([paso('a'), paso('b'), paso('c')]), entorno, TIEMPOS);
    expect(await sesion.primero()).toBe(0);
    expect(await sesion.siguiente(0)).toBe(2);
    expect(sesion.terminada).toBe(false);
    expect(await sesion.anterior(2)).toBe(0);
  });

  it('salta el paso cuya acción falla porque no hay entidad', async () => {
    const presentes = new Set(['[data-tour="b"]']);
    const { entorno } = entornoDePrueba(presentes, { inspeccionar: vi.fn(() => false) });
    const sesion = crearSesionDeGuia(
      guia([paso('a', { antes: { tipo: 'inspeccionar', entidad: 'tarjeta' } }), paso('b')]),
      entorno,
      TIEMPOS,
    );
    expect(await sesion.primero()).toBe(1);
  });

  it('al agotar los pasos marca la guía como terminada', async () => {
    const { entorno } = entornoDePrueba(new Set(['[data-tour="a"]']));
    const sesion = crearSesionDeGuia(guia([paso('a')]), entorno, TIEMPOS);
    await sesion.primero();
    expect(await sesion.siguiente(0)).toBeNull();
    expect(sesion.terminada).toBe(true);
  });

  it('un paso con esperar falso no espera', async () => {
    const esperar = vi.fn(async () => true);
    const { entorno } = entornoDePrueba(new Set(['[data-tour="a"]']), { esperar });
    await crearSesionDeGuia(guia([paso('a', { esperar: false })]), entorno, TIEMPOS).primero();
    expect(esperar).not.toHaveBeenCalled();
  });

  it('no repite un clic reversible que ya está activo', async () => {
    const presentes = new Set(['[data-tour="a"]', '[data-tour="b"]']);
    const abrirPanel: AccionDeGuia = { tipo: 'clic', selector: '[data-tour="x"]', deshacer: '[data-tour="x"]' };
    const { entorno, registro } = entornoDePrueba(presentes);
    const sesion = crearSesionDeGuia(
      guia([paso('a', { antes: abrirPanel }), paso('b', { antes: abrirPanel })]),
      entorno,
      TIEMPOS,
    );
    await sesion.primero();
    await sesion.siguiente(0);
    expect(registro.filter((linea) => linea === 'clic:[data-tour="x"]')).toHaveLength(1);
  });

  it('al cerrar deshace los clics y cierra formulario e inspector abiertos por la guía', async () => {
    const presentes = new Set(['[data-tour="a"]', '[data-tour="b"]', '[data-tour="x"]']);
    const { entorno, registro } = entornoDePrueba(presentes);
    const sesion = crearSesionDeGuia(
      guia([
        paso('a', { antes: [abrirGasto, { tipo: 'inspeccionar', entidad: 'movimiento' }] }),
        paso('b', { antes: { tipo: 'clic', selector: '[data-tour="y"]', deshacer: 'escape' } }),
        paso('a', { antes: { tipo: 'clic', selector: '[data-tour="z"]', deshacer: '[data-tour="x"]' } }),
      ]),
      entorno,
      TIEMPOS,
    );
    await sesion.primero();
    await sesion.siguiente(0);
    await sesion.siguiente(1);
    registro.length = 0;
    sesion.cerrar();
    expect(registro).toEqual(['clic:[data-tour="x"]', 'escape', 'cerrarFormulario', 'cerrarInspector']);
    registro.length = 0;
    sesion.cerrar();
    expect(registro).toEqual([]);
  });

  it('no cierra nada que la guía no abrió', async () => {
    const { entorno, registro } = entornoDePrueba(new Set(['[data-tour="a"]']));
    const sesion = crearSesionDeGuia(guia([paso('a')]), entorno, TIEMPOS);
    await sesion.primero();
    sesion.cerrar();
    expect(registro).toEqual([]);
  });
});
