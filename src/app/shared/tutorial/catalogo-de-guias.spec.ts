import { describe, expect, it } from 'vitest';
import en from '@core/i18n/en';
import es from '@core/i18n/es';
import fr from '@core/i18n/fr';
import pt from '@core/i18n/pt';
import { P } from '@core/session/permissions';
import { navigation } from '@core/state/navigation';
import { guiasDisponibles, selectoresDeGuia, type AccionDeGuia, type ContextoDeGuias } from './catalogo-de-guias';

type GlobDeVite = (patron: string, opciones: { query: string; import: string; eager: true }) => Record<string, string>;

const plantillas = (import.meta as unknown as { glob: GlobDeVite }).glob('/src/app/**/*.{html,ts}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function permisosDe(): string[] {
  const recolectados: string[] = [];
  const visitar = (nodo: unknown): void => {
    if (typeof nodo === 'string') recolectados.push(nodo);
    else if (nodo && typeof nodo === 'object') Object.values(nodo).forEach(visitar);
  };
  visitar(P);
  return recolectados;
}

function contexto(
  permitidos: 'todos' | readonly string[] = 'todos',
  activa: (bandera: string) => boolean = () => true,
): ContextoDeGuias {
  const conjunto = permitidos === 'todos' ? null : new Set(permitidos);
  return { t: (clave) => clave, puede: (permiso) => !conjunto || conjunto.has(permiso), activa };
}

const sinPermisos = (...quitar: string[]) => permisosDe().filter((permiso) => !quitar.includes(permiso));

describe('catálogo de guías', () => {
  it('con todos los permisos hay una guía por cada sección de la navegación', () => {
    const rutas = new Set(guiasDisponibles(contexto()).map((guia) => guia.ruta));
    for (const seccion of navigation) expect(rutas, seccion.path).toContain(seccion.path);
  });

  it('sin permisos de administración no aparece la guía de Administración', () => {
    const ids = guiasDisponibles(contexto(sinPermisos(P.administracion.ver))).map((guia) => guia.id);
    expect(ids).not.toContain('administracion');
    expect(guiasDisponibles(contexto()).map((guia) => guia.id)).toContain('administracion');
  });

  it('sin movimientos.crear no aparecen las guías de altas de movimientos', () => {
    const ids = guiasDisponibles(contexto(sinPermisos(P.movimientos.crear))).map((guia) => guia.id);
    for (const id of ['gasto', 'ingreso', 'compra-tarjeta', 'transferencia', 'prestamo']) expect(ids).not.toContain(id);
    expect(ids).toContain('buscar-filtrar');
  });

  it('una bandera apagada saca la guía de la sección', () => {
    const ids = guiasDisponibles(contexto('todos', (bandera) => bandera !== 'calendar')).map((guia) => guia.id);
    expect(ids).not.toContain('calendario');
    expect(ids).toContain('gasto');
  });

  it('omite los pasos cuyo permiso falta', () => {
    const con = guiasDisponibles(contexto()).find((guia) => guia.id === 'primeros-pasos')!;
    const sin = guiasDisponibles(contexto(sinPermisos(P.movimientos.crear))).find(
      (guia) => guia.id === 'primeros-pasos',
    )!;
    expect(con.pasos.map((paso) => paso.selector)).toContain('[data-tour="nuevo-movimiento"]');
    expect(sin.pasos.map((paso) => paso.selector)).not.toContain('[data-tour="nuevo-movimiento"]');
    expect(sin.pasos.length).toBe(con.pasos.length - 1);
  });

  it('cada guía tiene al menos 3 pasos y textos no vacíos', () => {
    for (const guia of guiasDisponibles(contexto())) {
      expect(guia.pasos.length, guia.id).toBeGreaterThanOrEqual(3);
      expect(guia.titulo, guia.id).toBeTruthy();
      expect(guia.resumen, guia.id).toBeTruthy();
      expect(guia.categoria, guia.id).toBeTruthy();
      for (const paso of guia.pasos) {
        expect(paso.titulo, guia.id).toBeTruthy();
        expect(paso.texto, guia.id).toBeTruthy();
      }
    }
  });

  it('los ids de las guías son únicos', () => {
    const ids = guiasDisponibles(contexto()).map((guia) => guia.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todas las claves usadas existen con texto en es, en, fr y pt', () => {
    const claves = new Set<string>();
    for (const guia of guiasDisponibles(contexto())) {
      claves.add(guia.titulo);
      claves.add(guia.resumen);
      claves.add(guia.categoria);
      for (const paso of guia.pasos) {
        claves.add(paso.titulo);
        claves.add(paso.texto);
      }
    }
    const idiomas: Record<string, Record<string, string>> = { es, en, fr, pt };
    for (const [idioma, catalogo] of Object.entries(idiomas))
      for (const clave of claves) expect((catalogo[clave] ?? '').trim(), `${idioma}:${clave}`).not.toBe('');
  });

  it('cada data-tour usado por las guías existe en alguna plantilla', () => {
    const fuentes = Object.entries(plantillas)
      .filter(([ruta]) => !ruta.includes('catalogo-de-guias') && !ruta.includes('.spec.'))
      .map(([, texto]) => texto)
      .join('\n');
    const presentes = new Set([...fuentes.matchAll(/data-tour="([a-z0-9-]+)"/g)].map((m) => m[1]));
    const usados = new Set(selectoresDeGuia().map((selector) => /data-tour="([a-z0-9-]+)"/.exec(selector)?.[1]));
    expect(usados.size).toBeGreaterThan(40);
    for (const id of usados) expect(presentes.has(id!), `data-tour ${id}`).toBe(true);
  });

  it('las acciones usan formularios y entidades conocidos', () => {
    const acciones: AccionDeGuia[] = [];
    for (const guia of guiasDisponibles(contexto()))
      for (const paso of guia.pasos) acciones.push(...[paso.antes ?? []].flat());
    expect(acciones.length).toBeGreaterThan(20);
    for (const accion of acciones)
      expect(['navegar', 'abrirFormulario', 'inspeccionar', 'clic', 'cerrar']).toContain(accion.tipo);
  });
});
