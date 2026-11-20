import { describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { guiasDisponibles, type ContextoDeGuias, type Guia } from './catalogo-de-guias';

const codigos = (() => {
  const todos: string[] = [];
  const visitar = (nodo: unknown): void => {
    if (typeof nodo === 'string') todos.push(nodo);
    else if (nodo && typeof nodo === 'object') Object.values(nodo).forEach(visitar);
  };
  visitar(P);
  return todos;
})();

const contexto = (puede: (permiso: string) => boolean): ContextoDeGuias => ({
  t: (clave) => clave,
  puede,
  activa: () => true,
});

const TODO = contexto(() => true);
const SOLO_LECTURA = contexto((permiso) => /\.(ver|listar)$/.test(permiso));
const NADA = contexto(() => false);

const abreFormularios = (guia: Guia) =>
  guia.pasos.some((paso) => [paso.antes ?? []].flat().some((accion) => accion.tipo === 'abrirFormulario'));

describe('guías del tutorial según permiso', () => {
  it('el catálogo completo conserva sus guías además de los primeros pasos', () => {
    const guias = guiasDisponibles(TODO);

    expect(guias.filter((g) => g.id !== 'primeros-pasos').length).toBeGreaterThanOrEqual(30);
  });

  it('quien solo lee no ve ninguna guía que abra un formulario de alta', () => {
    const altas = guiasDisponibles(SOLO_LECTURA).filter(abreFormularios);

    expect(altas.map((g) => g.id)).toEqual([]);
  });

  it('con todos los permisos sí hay guías de alta', () => {
    expect(guiasDisponibles(TODO).filter(abreFormularios).length).toBeGreaterThan(5);
  });

  it('quien solo lee ve menos guías que quien puede todo', () => {
    expect(guiasDisponibles(SOLO_LECTURA).length).toBeLessThan(guiasDisponibles(TODO).length);
  });

  it('ninguna guía llega vacía: si todos sus pasos se filtran, la guía no se ofrece', () => {
    for (const ctx of [TODO, SOLO_LECTURA, NADA])
      for (const guia of guiasDisponibles(ctx)) expect(guia.pasos.length, guia.id).toBeGreaterThan(0);
  });

  it('un paso con permiso solo se ofrece a quien lo tiene', () => {
    for (const guia of guiasDisponibles(SOLO_LECTURA))
      for (const paso of guia.pasos)
        for (const permiso of [paso.permiso ?? []].flat())
          expect(SOLO_LECTURA.puede(permiso), `${guia.id}: ${permiso}`).toBe(true);
  });

  it('cada permiso que una guía exige existe en el catálogo de permisos', () => {
    const conocidos = new Set(codigos);
    const exigidos = new Set<string>();
    for (const guia of guiasDisponibles(TODO)) {
      for (const permiso of [guia.permiso ?? []].flat()) exigidos.add(permiso);
      for (const paso of guia.pasos) for (const permiso of [paso.permiso ?? []].flat()) exigidos.add(permiso);
    }

    expect([...exigidos].filter((permiso) => !conocidos.has(permiso))).toEqual([]);
  });

  it('sin ningún permiso solo quedan guías que no piden permiso', () => {
    for (const guia of guiasDisponibles(NADA)) expect([guia.permiso ?? []].flat(), guia.id).toEqual([]);
  });
});
