import { describe, expect, it } from 'vitest';
import { P } from './permissions';

const SIN_PANTALLA_TODAVIA: Readonly<Record<string, string>> = {
  'sesion.ver': 'La sesión misma. No hay control que ocultar.',
  'organizacion.auditoria.listar': 'La auditoría por organización no tiene pantalla propia.',
  'organizacion.banderas.listar':
    'Los valores efectivos se cargan para toda sesión; este permiso solo conserva compatibilidad del contrato.',
  'organizacion.banderas.editar': 'Igual que la anterior.',
  'dashboard.widget.editar': 'Concesión paraguas: la pantalla mira las cuatro acciones concretas.',
  'movimientos.detalle.ver': 'El inspector usa la fila ya cargada, no pide el detalle.',
  'cuentas.extracto.ver': 'El extracto se estima con lo que ya hay en pantalla.',
  'cuentas.historial.ver': 'El historial de cambios vive en la auditoría de Administración.',
  'preferencias.datos.eliminar':
    'Sin modo demo no hay datos locales que restaurar; queda por compatibilidad del contrato.',
};

function aplanar(nodo: unknown, prefijo = 'P'): [string, string][] {
  if (typeof nodo === 'string') return [[prefijo, nodo]];
  return Object.entries(nodo as Record<string, unknown>).flatMap(([clave, valor]) =>
    aplanar(valor, `${prefijo}.${clave}`),
  );
}

type GlobDeVite = (patron: string, opciones: { query: string; import: string; eager: true }) => Record<string, string>;

const modulos = (import.meta as unknown as { glob: GlobDeVite }).glob('/src/app/**/*.{ts,html}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('cada permiso sirve para algo', () => {
  const declarados = aplanar(P);
  const comprobables = Object.entries(modulos)
    .filter(([ruta]) => !ruta.endsWith('.spec.ts'))
    .filter(([ruta]) => !ruta.endsWith('/permissions.ts') && !ruta.endsWith('/view-model.ts'))
    .map(([, fuente]) => fuente)
    .join('\n');
  const comprobados = new Set(comprobables.match(/P\.[A-Za-zÁÉÍÓÚáéíóúñÑ]+(?:\.[A-Za-z]+)*/g) ?? []);

  it('el catálogo del cliente tiene los 117 códigos', () => {
    expect(declarados).toHaveLength(117);
  });

  it('ninguno se puede marcar sin que nada lo mire', () => {
    const muertos = declarados
      .filter(([ruta]) => !comprobados.has(ruta))
      .map(([, codigo]) => codigo)
      .filter((codigo) => !(codigo in SIN_PANTALLA_TODAVIA))
      .sort();

    expect(muertos, `estos permisos no los comprueba nadie: ${muertos.join(', ')}`).toEqual([]);
  });

  it('la lista de excepciones no guarda permisos que ya tienen pantalla', () => {
    const sobran = declarados
      .filter(([ruta, codigo]) => codigo in SIN_PANTALLA_TODAVIA && comprobados.has(ruta))
      .map(([, codigo]) => codigo)
      .sort();

    expect(sobran, `ya tienen pantalla y siguen en la lista: ${sobran.join(', ')}`).toEqual([]);
  });
});
