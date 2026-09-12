import { describe, expect, it } from 'vitest';
import { P } from './permissions';

/**
 * Cada permiso tiene que servir para algo.
 *
 * Un código que la consola deja marcar y desmarcar pero que ninguna pantalla mira es un
 * interruptor muerto: quien administra cree estar concediendo o retirando algo, y no pasa
 * nada. Es peor que no ofrecerlo, porque parece que funciona.
 *
 * Los de esta lista no los mira el cliente a propósito, y cada uno dice por qué. Al darle
 * pantalla a alguno hay que sacarlo de aquí, y la tercera prueba avisa si se queda de más.
 */
const SIN_PANTALLA_TODAVIA: Readonly<Record<string, string>> = {
  'sesion.ver': 'La sesión misma. No hay control que ocultar.',
  'sesion.monedas.listar': 'Catálogo de monedas: alimenta selectores, no se decide aquí.',
  'organizacion.auditoria.listar': 'La auditoría por organización no tiene pantalla propia.',
  'organizacion.banderas.listar':
    'Los valores efectivos se cargan para toda sesión; este permiso solo conserva compatibilidad del contrato.',
  'organizacion.banderas.editar': 'Igual que la anterior.',
  'personas.compras.listar': 'El endpoint existe y ninguna vista lo consume.',
  'personas.liquidaciones.listar': 'El endpoint existe y ninguna vista lo consume.',
  'cuentas.editar': 'No hay interfaz de edición de cuenta.',
  'cuentas.categorias.editar': 'No hay interfaz de edición de categoría.',
  'cuentas.tarjetas.editar': 'No hay interfaz de edición de tarjeta.',
  'personas.editar': 'No hay interfaz de edición de persona.',
  'patrimonio.inversiones.editar': 'No hay interfaz de valoración.',
  'administracion.roles.eliminar': 'La consola no ofrece borrar un rol.',
  'dashboard.widget.editar': 'Concesión paraguas: la pantalla mira las cuatro acciones concretas.',
  'movimientos.detalle.ver': 'El inspector usa la fila ya cargada, no pide el detalle.',
  'cuentas.extracto.ver': 'El extracto se estima con lo que ya hay en pantalla.',
};

/** Cada hoja de `P`, con la ruta por la que se escribe en el código y su código. */
function aplanar(nodo: unknown, prefijo = 'P'): [string, string][] {
  if (typeof nodo === 'string') return [[prefijo, nodo]];
  return Object.entries(nodo as Record<string, unknown>).flatMap(([clave, valor]) =>
    aplanar(valor, `${prefijo}.${clave}`),
  );
}

/**
 * Vite entrega las fuentes como texto: la prueba no necesita leer el disco, así que
 * corre igual en el entorno de navegador donde vive el resto.
 *
 * El tipo se declara aquí porque la configuración de TypeScript de la aplicación no
 * incluye los tipos de Vite, y añadirlos solo para esto tocaría el build de producción.
 */
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
    // El catálogo declara y los perfiles demo conceden: ninguno de los dos comprueba.
    .filter(([ruta]) => !ruta.endsWith('/permissions.ts') && !ruta.endsWith('/demo-data.ts'))
    .map(([, fuente]) => fuente)
    .join('\n');
  const comprobados = new Set(comprobables.match(/P\.[A-Za-zÁÉÍÓÚáéíóúñÑ]+(?:\.[A-Za-z]+)*/g) ?? []);

  it('el catálogo del cliente tiene los 102 códigos', () => {
    expect(declarados).toHaveLength(102);
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

    // Al darle pantalla a uno hay que sacarlo de la lista, o deja de vigilarse.
    expect(sobran, `ya tienen pantalla y siguen en la lista: ${sobran.join(', ')}`).toEqual([]);
  });
});
