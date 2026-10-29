import { describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { pasosDe, type ContextoDeTutorial } from './pasos-del-tutorial';

const SECCIONES = [
  'dashboard',
  'movements',
  'calendar',
  'accounts',
  'people',
  'portfolio',
  'planning',
  'reports',
  'notifications',
  'settings',
];

function contexto(permitidos: 'todos' | 'ninguno' = 'todos'): ContextoDeTutorial {
  return { t: (clave) => `«${clave}»`, puede: () => permitidos === 'todos' };
}

describe('pasos del tutorial', () => {
  it.each(SECCIONES)('la sección %s devuelve pasos propios además de los del armazón', (seccion) => {
    const armazon = pasosDe('desconocida', contexto());
    expect(pasosDe(seccion, contexto()).length).toBeGreaterThan(armazon.length);
  });

  it('una sección desconocida solo trae los pasos del armazón', () => {
    const selectores = pasosDe('admin', contexto()).map((paso) => paso.selector);
    expect(selectores[0]).toBe('[data-tour="navegacion"]');
    expect(selectores).toContain('[data-tour="buscar"]');
    expect(selectores).toContain('[data-tour="perfil"]');
    expect(selectores).toContain('[data-tour="reportar"]');
  });

  it('todos los selectores usan data-tour', () => {
    for (const seccion of SECCIONES)
      for (const paso of pasosDe(seccion, contexto())) expect(paso.selector).toMatch(/^\[data-tour="[a-z-]+"\]$/);
  });

  it('omite los pasos cuyo permiso no se tiene', () => {
    const sin = pasosDe('movements', { t: (c) => c, puede: (p) => p !== P.movimientos.exportar });
    const con = pasosDe('movements', contexto());
    expect(con.map((p) => p.selector)).toContain('[data-tour="movimientos-exportar"]');
    expect(sin.map((p) => p.selector)).not.toContain('[data-tour="movimientos-exportar"]');
    expect(sin.length).toBe(con.length - 1);
  });

  it('sin ningún permiso desaparecen los pasos protegidos', () => {
    const selectores = pasosDe('accounts', contexto('ninguno')).map((p) => p.selector);
    expect(selectores).not.toContain('[data-tour="nuevo-movimiento"]');
    expect(selectores).not.toContain('[data-tour="cuentas-nueva"]');
    expect(selectores).not.toContain('[data-tour="cuentas-abono"]');
  });

  it('los textos salen de i18n', () => {
    for (const paso of pasosDe('dashboard', contexto())) {
      expect(paso.titulo).toMatch(/^«tutorial\.step\..+\.title»$/);
      expect(paso.texto).toMatch(/^«tutorial\.step\..+\.text»$/);
    }
  });
});
