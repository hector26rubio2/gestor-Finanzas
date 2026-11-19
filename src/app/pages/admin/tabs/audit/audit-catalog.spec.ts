import { describe, expect, it } from 'vitest';
import en from '@core/i18n/en';
import es from '@core/i18n/es';
import fr from '@core/i18n/fr';
import pt from '@core/i18n/pt';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, endOfDayIso, prettyJson, startOfDayIso } from './audit-catalog';

describe('catálogo de auditoría', () => {
  it('no repite acciones ni entidades', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
    expect(new Set(AUDIT_ENTITIES).size).toBe(AUDIT_ENTITIES.length);
  });

  it.each([
    ['es', es],
    ['en', en],
    ['fr', fr],
    ['pt', pt],
  ])('cada acción y cada entidad tiene su nombre en %s', (_idioma, textos) => {
    const diccionario = textos as Record<string, string>;
    const sinAccion = AUDIT_ACTIONS.filter((accion) => !diccionario[`admin.audit.actionName.${accion}`]);
    const sinEntidad = AUDIT_ENTITIES.filter((entidad) => !diccionario[`admin.audit.entityName.${entidad}`]);

    expect(sinAccion).toEqual([]);
    expect(sinEntidad).toEqual([]);
  });
});

describe('prettyJson', () => {
  it('sangra un JSON válido para leerlo', () => {
    expect(prettyJson('{"a":1,"b":[2]}')).toBe('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}');
  });

  it('si no es JSON devuelve el texto tal cual', () => {
    expect(prettyJson('no es json')).toBe('no es json');
  });

  it('sin cambios registrados devuelve vacío', () => {
    expect(prettyJson(null)).toBe('');
    expect(prettyJson('')).toBe('');
  });
});

describe('rango de fechas del filtro', () => {
  it('sin fecha no hay límite', () => {
    expect(startOfDayIso('')).toBeUndefined();
    expect(endOfDayIso('')).toBeUndefined();
  });

  it('desde es el primer instante del día y hasta el último, del mismo día local', () => {
    const desde = new Date(startOfDayIso('2026-11-18')!);
    const hasta = new Date(endOfDayIso('2026-11-18')!);

    expect([desde.getFullYear(), desde.getMonth(), desde.getDate(), desde.getHours(), desde.getMinutes()]).toEqual([
      2026, 10, 18, 0, 0,
    ]);
    expect([hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), hasta.getHours(), hasta.getMinutes()]).toEqual([
      2026, 10, 18, 23, 59,
    ]);
    expect(hasta.getTime() - desde.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('un mismo día como desde y hasta incluye todo ese día', () => {
    const desde = new Date(startOfDayIso('2026-11-18')!).getTime();
    const hasta = new Date(endOfDayIso('2026-11-18')!).getTime();
    const mediodia = new Date('2026-11-18T12:00:00').getTime();

    expect(mediodia).toBeGreaterThanOrEqual(desde);
    expect(mediodia).toBeLessThanOrEqual(hasta);
  });
});
