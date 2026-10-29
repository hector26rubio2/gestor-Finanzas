import { P } from '@core/session/permissions';
import type { AppStore } from '@core/state/store';

export type FormularioDeGuia = NonNullable<ReturnType<AppStore['form']>>;
export type EntidadDeGuia = 'movimiento' | 'cuenta' | 'tarjeta' | 'persona' | 'inversion';

export type AccionDeGuia =
  | { tipo: 'navegar'; ruta: string; params?: Readonly<Record<string, string>> }
  | { tipo: 'abrirFormulario'; form: FormularioDeGuia; con?: 'tarjeta' | 'inversion' }
  | { tipo: 'inspeccionar'; entidad: EntidadDeGuia }
  | { tipo: 'clic'; selector: string; deshacer?: string }
  | { tipo: 'cerrar' };

export interface PasoDeGuia {
  selector: string;
  titulo: string;
  texto: string;
  permiso?: string | string[];
  antes?: AccionDeGuia | readonly AccionDeGuia[];
  esperar?: boolean;
  interactivo?: boolean;
}

export interface Guia {
  id: string;
  categoria: string;
  titulo: string;
  resumen: string;
  permiso?: string | string[];
  bandera?: string;
  ruta: string;
  pasos: PasoDeGuia[];
}

export interface ContextoDeGuias {
  t: (clave: string) => string;
  puede: (permiso: string) => boolean;
  activa: (bandera: string) => boolean;
}

interface Receta {
  id: string;
  tour: string;
  permiso?: string | string[];
  antes?: AccionDeGuia | readonly AccionDeGuia[];
  interactivo?: boolean;
}

interface RecetaDeGuia {
  id: string;
  categoria: string;
  ruta: string;
  permiso?: string | string[];
  bandera?: string;
  pasos: readonly Receta[];
}

const abrir = (form: FormularioDeGuia, con?: 'tarjeta' | 'inversion'): AccionDeGuia => ({
  tipo: 'abrirFormulario',
  form,
  con,
});
const clic = (tour: string, deshacer?: string): AccionDeGuia => ({
  tipo: 'clic',
  selector: `[data-tour="${tour}"]`,
  deshacer: deshacer === undefined ? undefined : deshacer === 'escape' ? 'escape' : `[data-tour="${deshacer}"]`,
});
const inspeccionar = (entidad: EntidadDeGuia): AccionDeGuia => ({ tipo: 'inspeccionar', entidad });
const navegar = (ruta: string, params?: Record<string, string>): AccionDeGuia => ({ tipo: 'navegar', ruta, params });
const paso = (id: string, tour: string, extra: Partial<Receta> = {}): Receta => ({ id, tour, ...extra });

const GASTO = abrir({ kind: 'expense', operationType: 'normal' });
const PRESTAMO_DADO = abrir({ kind: 'expense', operationType: 'loan' });

const RECETAS: readonly RecetaDeGuia[] = [
  {
    id: 'primeros-pasos',
    categoria: 'inicio',
    ruta: 'dashboard',
    pasos: [
      paso('navegacion', 'navegacion'),
      paso('menu', 'menu-colapsar'),
      paso('buscar', 'buscar'),
      paso('nuevo-movimiento', 'nuevo-movimiento', { permiso: P.movimientos.crear }),
      paso('notificaciones', 'notificaciones'),
      paso('perfil', 'perfil'),
      paso('reportar', 'reportar'),
    ],
  },
  {
    id: 'gasto',
    categoria: 'movimientos',
    ruta: 'movements',
    permiso: P.movimientos.crear,
    bandera: 'movements',
    pasos: [
      paso('tipo', 'form-tipo', { antes: GASTO }),
      paso('fecha', 'form-fecha'),
      paso('monto', 'form-monto'),
      paso('cuenta', 'form-cuenta'),
      paso('categoria', 'form-categoria'),
      paso('categoria-nueva', 'form-categoria-nueva', { permiso: P.cuentas.categorias.crear }),
      paso('atribucion', 'form-atribucion'),
      paso('recurrente', 'form-recurrente'),
      paso('descripcion', 'form-descripcion'),
      paso('guardar', 'form-guardar'),
    ],
  },
  {
    id: 'ingreso',
    categoria: 'movimientos',
    ruta: 'movements',
    permiso: P.movimientos.crear,
    bandera: 'movements',
    pasos: [
      paso('tipo', 'form-tipo', { antes: abrir({ kind: 'income', operationType: 'normal' }) }),
      paso('operacion', 'form-operacion'),
      paso('fecha', 'form-fecha'),
      paso('monto', 'form-monto'),
      paso('cuenta', 'form-cuenta'),
      paso('categoria', 'form-categoria'),
      paso('descripcion', 'form-descripcion'),
      paso('guardar', 'form-guardar'),
    ],
  },
  {
    id: 'compra-tarjeta',
    categoria: 'movimientos',
    ruta: 'movements',
    permiso: P.movimientos.crear,
    bandera: 'movements',
    pasos: [
      paso('cuenta', 'form-cuenta', { antes: abrir({ kind: 'expense', operationType: 'normal' }, 'tarjeta') }),
      paso('tipo-compra', 'form-tipo-compra'),
      paso('cuotas', 'form-cuotas'),
      paso('tasa', 'form-tasa-cuotas'),
      paso('cuota-actual', 'form-cuota-actual'),
      paso('moneda', 'form-moneda-compra'),
      paso('guardar', 'form-guardar'),
    ],
  },
  {
    id: 'transferencia',
    categoria: 'movimientos',
    ruta: 'movements',
    permiso: [P.movimientos.crear, P.movimientos.transferencias.crear],
    bandera: 'movements',
    pasos: [
      paso('operacion', 'form-operacion', { antes: abrir({ kind: 'expense', operationType: 'transfer' }) }),
      paso('fecha', 'form-fecha'),
      paso('monto', 'form-monto'),
      paso('origen', 'form-cuenta'),
      paso('destino', 'form-cuenta-destino'),
      paso('descripcion', 'form-descripcion'),
      paso('guardar', 'form-guardar'),
    ],
  },
  {
    id: 'prestamo',
    categoria: 'movimientos',
    ruta: 'movements',
    permiso: [P.movimientos.crear, P.movimientos.prestamos.crear],
    bandera: 'movements',
    pasos: [
      paso('dado-operacion', 'form-operacion', { antes: PRESTAMO_DADO, permiso: P.personas.prestamos.crear }),
      paso('dado-persona', 'form-contraparte', { permiso: P.personas.prestamos.crear }),
      paso('dado-monto', 'form-monto', { permiso: P.personas.prestamos.crear }),
      paso('dado-tasa', 'form-tasa', { permiso: P.personas.prestamos.crear }),
      paso('dado-plazo', 'form-plazo', { permiso: P.personas.prestamos.crear }),
      paso('recibido-operacion', 'form-operacion', {
        antes: abrir({ kind: 'income', operationType: 'loan' }),
        permiso: P.personas.deudas.crear,
      }),
      paso('recibido-persona', 'form-contraparte', { permiso: P.personas.deudas.crear }),
      paso('recibido-guardar', 'form-guardar', { permiso: P.personas.deudas.crear }),
    ],
  },
  {
    id: 'compra-tercero',
    categoria: 'movimientos',
    ruta: 'movements',
    permiso: [P.movimientos.crear, P.movimientos.prestamos.crear, P.personas.deudas.crear],
    bandera: 'movements',
    pasos: [
      paso('atribucion', 'form-atribucion', { antes: GASTO }),
      paso('tarjeta-prestada-operacion', 'form-operacion', {
        antes: abrir({ kind: 'expense', operationType: 'borrowedCard' }),
      }),
      paso('tarjeta-prestada', 'form-tarjeta-prestada'),
      paso('persona', 'form-contraparte'),
      paso('monto', 'form-monto'),
      paso('guardar', 'form-guardar'),
    ],
  },
  {
    id: 'crear-al-vuelo',
    categoria: 'movimientos',
    ruta: 'movements',
    permiso: P.movimientos.crear,
    bandera: 'movements',
    pasos: [
      paso('categoria', 'form-categoria', { antes: GASTO }),
      paso('categoria-mas', 'form-categoria-nueva', { permiso: P.cuentas.categorias.crear }),
      paso('categoria-nombre', 'form-categoria-alta', {
        permiso: P.cuentas.categorias.crear,
        antes: clic('form-categoria-nueva'),
      }),
      paso('persona-mas', 'form-contraparte-nueva', {
        permiso: [P.personas.crear, P.personas.prestamos.crear],
        antes: [{ tipo: 'cerrar' }, PRESTAMO_DADO],
      }),
      paso('persona-nombre', 'form-contraparte-alta', {
        permiso: [P.personas.crear, P.personas.prestamos.crear],
        antes: clic('form-contraparte-nueva'),
      }),
      paso('persona-relacion', 'form-contraparte-relacion', {
        permiso: [P.personas.crear, P.personas.prestamos.crear],
      }),
    ],
  },
  {
    id: 'buscar-filtrar',
    categoria: 'movimientos',
    ruta: 'movements',
    permiso: P.movimientos.ver,
    bandera: 'movements',
    pasos: [
      paso('kpis', 'movimientos-kpis'),
      paso('busqueda', 'tabla-busqueda', { interactivo: true }),
      paso('filtros', 'tabla-filtros'),
      paso('columnas', 'tabla-columnas'),
      paso('tabla', 'movimientos-tabla'),
      paso('exportar', 'movimientos-exportar', { permiso: P.movimientos.exportar }),
    ],
  },
  {
    id: 'editar-reversar',
    categoria: 'movimientos',
    ruta: 'movements',
    permiso: P.movimientos.ver,
    bandera: 'movements',
    pasos: [
      paso('tabla', 'movimientos-tabla'),
      paso('detalle', 'detalle-datos', { antes: inspeccionar('movimiento') }),
      paso('editar', 'detalle-editar', { permiso: P.movimientos.editar }),
      paso('compartir', 'detalle-compartir', { permiso: P.personas.compras.crear }),
      paso('reversar', 'detalle-reversar', { permiso: P.movimientos.deshabilitar }),
    ],
  },
  {
    id: 'crear-cuenta',
    categoria: 'cuentas',
    ruta: 'accounts',
    permiso: P.cuentas.crear,
    bandera: 'accounts',
    pasos: [
      paso('boton', 'cuentas-nueva'),
      paso('tipo', 'form-cuenta-tipo', { antes: abrir({ kind: 'account', accountType: 'savings' }) }),
      paso('nombre', 'form-cuenta-nombre'),
      paso('moneda', 'form-cuenta-moneda'),
      paso('saldo', 'form-cuenta-saldo'),
      paso('ultimos', 'form-cuenta-ultimos'),
      paso('entidad', 'form-cuenta-entidad'),
      paso('guardar', 'form-cuenta-guardar'),
    ],
  },
  {
    id: 'crear-tarjeta',
    categoria: 'cuentas',
    ruta: 'accounts',
    permiso: [P.cuentas.crear, P.cuentas.tarjetas.crear],
    bandera: 'accounts',
    pasos: [
      paso('tipo', 'form-cuenta-tipo', { antes: abrir({ kind: 'account', accountType: 'credit' }) }),
      paso('nombre', 'form-cuenta-nombre'),
      paso('cupo', 'form-cuenta-cupo'),
      paso('corte', 'form-cuenta-corte'),
      paso('pago', 'form-cuenta-pago'),
      paso('tasa', 'form-cuenta-tasa'),
      paso('cuota-manejo', 'form-cuenta-cuota-manejo'),
      paso('prioridad', 'form-cuenta-prioridad'),
      paso('guardar', 'form-cuenta-guardar'),
    ],
  },
  {
    id: 'abonar-tarjeta',
    categoria: 'cuentas',
    ruta: 'accounts',
    permiso: [P.cuentas.ver, P.movimientos.pagos.crear],
    bandera: 'accounts',
    pasos: [
      paso('tarjetas', 'cuentas-tarjetas'),
      paso('detalle', 'detalle-datos', { antes: inspeccionar('tarjeta') }),
      paso('boton', 'detalle-abonar'),
      paso('origen', 'abono-origen', { antes: clic('detalle-abonar') }),
      paso('monto', 'abono-monto'),
      paso('reparto', 'abono-reparto'),
      paso('confirmar', 'abono-confirmar'),
    ],
  },
  {
    id: 'extracto',
    categoria: 'cuentas',
    ruta: 'accounts',
    permiso: [P.cuentas.ver, P.cuentas.extracto.ver],
    bandera: 'accounts',
    pasos: [
      paso('kpis', 'cuentas-kpis'),
      paso('tabla', 'cuentas-tabla'),
      paso('extracto', 'detalle-extracto', { antes: inspeccionar('tarjeta') }),
      paso('editar', 'detalle-editar-cuenta', { permiso: P.cuentas.editar }),
      paso('desactivar', 'detalle-desactivar', { permiso: P.cuentas.deshabilitar }),
    ],
  },
  {
    id: 'calendario',
    categoria: 'calendario',
    ruta: 'calendar',
    permiso: P.calendario.ver,
    bandera: 'calendar',
    pasos: [
      paso('vistas', 'calendario-vistas', { interactivo: true }),
      paso('anterior', 'calendario-anterior'),
      paso('hoy', 'calendario-hoy'),
      paso('siguiente', 'calendario-siguiente'),
      paso('dia', 'calendario-dia'),
      paso('agenda', 'calendario-agenda'),
    ],
  },
  {
    id: 'recurrente',
    categoria: 'calendario',
    ruta: 'calendar',
    permiso: [P.calendario.ver, P.calendario.recurrencias.crear],
    bandera: 'calendar',
    pasos: [
      paso('monto', 'form-recurrente-monto', { antes: abrir({ kind: 'recurrence' }) }),
      paso('cuenta', 'form-recurrente-cuenta'),
      paso('frecuencia', 'form-recurrente-frecuencia'),
      paso('inicio', 'form-recurrente-inicio'),
      paso('guardar', 'form-gestion-guardar'),
      paso('lista', 'calendario-recurrentes', { antes: { tipo: 'cerrar' } }),
      paso('eliminar', 'calendario-eliminar', { permiso: P.calendario.recurrencias.deshabilitar }),
      paso('materializar', 'calendario-materializar', { permiso: P.calendario.proyecciones.crear }),
    ],
  },
  {
    id: 'crear-persona',
    categoria: 'personas',
    ruta: 'people',
    permiso: P.personas.crear,
    bandera: 'people',
    pasos: [
      paso('boton', 'personas-nueva'),
      paso('tipo', 'form-gestion-tipo', { antes: abrir({ kind: 'person' }) }),
      paso('nombre', 'form-gestion-nombre'),
      paso('correo', 'form-gestion-correo'),
      paso('relacion', 'form-gestion-relacion'),
      paso('guardar', 'form-gestion-guardar'),
    ],
  },
  {
    id: 'ver-deudas',
    categoria: 'personas',
    ruta: 'people',
    permiso: [P.personas.ver, P.personas.deudas.listar],
    bandera: 'people',
    pasos: [
      paso('tabla', 'personas-tabla'),
      paso('expandir', 'tabla-detalle'),
      paso('valor', 'deuda-columna-valor', { antes: clic('tabla-detalle', 'tabla-detalle') }),
      paso('cuota', 'deuda-columna-cuota'),
      paso('numero', 'deuda-columna-numero'),
      paso('pendiente', 'deuda-columna-pendiente'),
      paso('comportamiento', 'deuda-columna-comportamiento'),
    ],
  },
  {
    id: 'crear-inversion',
    categoria: 'patrimonio',
    ruta: 'portfolio',
    permiso: P.patrimonio.inversiones.crear,
    bandera: 'portfolio',
    pasos: [
      paso('boton', 'inversiones-nueva'),
      paso('instrumento', 'form-inversion-instrumento', { antes: abrir({ kind: 'investment' }) }),
      paso('moneda', 'form-inversion-moneda'),
      paso('riesgo', 'form-inversion-riesgo'),
      paso('simbolo', 'form-inversion-simbolo'),
      paso('institucion', 'form-inversion-institucion'),
      paso('guardar', 'form-gestion-guardar'),
    ],
  },
  {
    id: 'operar-inversion',
    categoria: 'patrimonio',
    ruta: 'portfolio',
    permiso: P.patrimonio.inversiones.editar,
    bandera: 'portfolio',
    pasos: [
      paso('acceso', 'detalle-operacion', { antes: inspeccionar('inversion') }),
      paso('tipo', 'form-operacion-tipo', {
        antes: [{ tipo: 'cerrar' }, abrir({ kind: 'investment-operation' }, 'inversion')],
      }),
      paso('fecha', 'form-operacion-fecha'),
      paso('monto', 'form-operacion-monto'),
      paso('cuenta', 'form-operacion-cuenta'),
      paso('cantidad', 'form-operacion-cantidad'),
      paso('precio', 'form-operacion-precio'),
      paso('guardar', 'form-operacion-guardar'),
    ],
  },
  {
    id: 'valorizacion',
    categoria: 'patrimonio',
    ruta: 'portfolio',
    permiso: P.patrimonio.inversiones.editar,
    bandera: 'portfolio',
    pasos: [
      paso('acceso', 'detalle-valorizacion', { antes: inspeccionar('inversion') }),
      paso('fecha', 'form-valorizacion-fecha', {
        antes: [{ tipo: 'cerrar' }, abrir({ kind: 'investment-valuation' }, 'inversion')],
      }),
      paso('valor', 'form-valorizacion-valor'),
      paso('fuente', 'form-valorizacion-fuente'),
      paso('referencia', 'form-valorizacion-referencia'),
      paso('guardar', 'form-valorizacion-guardar'),
    ],
  },
  {
    id: 'leer-inversion',
    categoria: 'patrimonio',
    ruta: 'portfolio',
    permiso: P.patrimonio.ver,
    bandera: 'portfolio',
    pasos: [
      paso('kpis', 'inversiones-kpis'),
      paso('tabla', 'inversiones-tabla'),
      paso('detalle', 'detalle-datos', { antes: inspeccionar('inversion') }),
      paso('operaciones', 'detalle-operaciones'),
      paso('valorizaciones', 'detalle-valorizaciones'),
    ],
  },
  {
    id: 'dashboard-basico',
    categoria: 'dashboard',
    ruta: 'dashboard',
    permiso: P.dashboard.ver,
    bandera: 'dashboard',
    pasos: [
      paso('vista', 'dashboard-vista', { interactivo: true }),
      paso('periodo', 'dashboard-periodo'),
      paso('filtros', 'dashboard-filtros'),
      paso('personalizar', 'dashboard-personalizar', { permiso: P.dashboard.widget.orden.editar }),
    ],
  },
  {
    id: 'crear-widget',
    categoria: 'dashboard',
    ruta: 'dashboard',
    permiso: [P.dashboard.ver, P.dashboard.widget.crear],
    bandera: 'dashboard',
    pasos: [
      paso('personalizar', 'dashboard-personalizar'),
      paso('panel', 'dashboard-panel', { antes: clic('dashboard-personalizar', 'dashboard-personalizar') }),
      paso('boton', 'dashboard-crear-widget'),
      paso('nombre', 'widget-nombre', { antes: clic('dashboard-crear-widget', 'escape') }),
      paso('ancho', 'widget-ancho'),
      paso('tipo', 'widget-tipo'),
      paso('datos', 'widget-datos'),
      paso('nota', 'widget-nota'),
      paso('guardar', 'widget-guardar'),
    ],
  },
  {
    id: 'crear-kpi',
    categoria: 'dashboard',
    ruta: 'dashboard',
    permiso: [P.dashboard.ver, P.dashboard.widget.crear],
    bandera: 'dashboard',
    pasos: [
      paso('kpis', 'dashboard-kpis'),
      paso('boton', 'dashboard-crear-kpi', { antes: clic('dashboard-personalizar', 'dashboard-personalizar') }),
      paso('nombre', 'kpi-nombre', { antes: clic('dashboard-crear-kpi', 'escape') }),
      paso('filtro', 'kpi-filtro'),
      paso('medida', 'kpi-medida'),
      paso('guardar', 'kpi-guardar'),
    ],
  },
  {
    id: 'tableros',
    categoria: 'dashboard',
    ruta: 'dashboard',
    permiso: [P.dashboard.ver, P.dashboard.tableros.crear],
    bandera: 'dashboard',
    pasos: [
      paso('selector', 'tableros-selector'),
      paso('nuevo', 'tablero-nuevo'),
      paso('nombre', 'tablero-nombre', { antes: clic('tablero-nuevo', 'tablero-cancelar') }),
      paso('guardar', 'tablero-guardar'),
      paso('fijar', 'tablero-fijar'),
      paso('compartir', 'tablero-compartir', { permiso: P.dashboard.tableros.accesos.editar }),
    ],
  },
  {
    id: 'planificacion-deudas',
    categoria: 'planificacion',
    ruta: 'planning',
    permiso: [P.planificacion.ver, P.planificacion.deudas.ver],
    bandera: 'planning',
    pasos: [
      paso('pestanas', 'planificacion-pestanas', { antes: navegar('planning', { objetivo: 'Deudas' }) }),
      paso('parametros', 'planificacion-parametros'),
      paso('deuda', 'planificacion-agregar-deuda'),
      paso('abono', 'planificacion-abono'),
      paso('tasa', 'planificacion-cambio-tasa'),
      paso('ingreso', 'planificacion-flujo-ingreso'),
      paso('gasto', 'planificacion-flujo-gasto'),
    ],
  },
  {
    id: 'planificacion-objetivos',
    categoria: 'planificacion',
    ruta: 'planning',
    permiso: P.planificacion.ver,
    bandera: 'planning',
    pasos: [
      paso('compra', 'planificacion-parametros', {
        permiso: P.planificacion.compras.ver,
        antes: navegar('planning', { objetivo: 'Compra' }),
      }),
      paso('vacaciones', 'planificacion-parametros', {
        permiso: P.planificacion.vacaciones.ver,
        antes: navegar('planning', { objetivo: 'Vacaciones' }),
      }),
      paso('inversion', 'planificacion-parametros', {
        permiso: P.planificacion.inversiones.ver,
        antes: navegar('planning', { objetivo: 'Inversión' }),
      }),
      paso('resultados', 'planificacion-resultados'),
    ],
  },
  {
    id: 'planificacion-escenarios',
    categoria: 'planificacion',
    ruta: 'planning',
    permiso: P.planificacion.ver,
    bandera: 'planning',
    pasos: [
      paso('vista', 'planificacion-vista', { interactivo: true }),
      paso('nombre', 'planificacion-nombre-escenario'),
      paso('guardar', 'planificacion-guardar-escenario'),
      paso('plan', 'planificacion-plan-guardado'),
      paso('resultados', 'planificacion-resultados'),
    ],
  },
  {
    id: 'reportes-resumen',
    categoria: 'reportes',
    ruta: 'reports',
    permiso: P.reportes.ver,
    bandera: 'reports',
    pasos: [
      paso('pestanas', 'reportes-pestanas'),
      paso('periodo', 'reportes-periodo'),
      paso('kpis', 'reportes-kpis'),
      paso('exportar', 'reportes-exportar', { permiso: P.reportes.exportar }),
    ],
  },
  {
    id: 'reportes-explorador',
    categoria: 'reportes',
    ruta: 'reports',
    permiso: P.reportes.ver,
    bandera: 'reports',
    pasos: [
      paso('filtros', 'explorador-filtros', { antes: clic('reportes-explorador') }),
      paso('agregar', 'explorador-agregar'),
      paso('mover', 'explorador-mover'),
      paso('ancho', 'explorador-ancho'),
      paso('duplicar', 'explorador-duplicar'),
      paso('editar', 'explorador-editar'),
      paso('quitar', 'explorador-quitar'),
      paso('guardar', 'explorador-guardado'),
    ],
  },
  {
    id: 'notificaciones',
    categoria: 'cuenta',
    ruta: 'notifications',
    permiso: P.notificaciones.ver,
    bandera: 'notifications',
    pasos: [
      paso('filtro', 'notificaciones-filtro', { interactivo: true }),
      paso('lista', 'notificaciones-lista'),
      paso('marcar', 'notificaciones-marcar', { permiso: P.notificaciones.editar }),
    ],
  },
  {
    id: 'preferencias',
    categoria: 'cuenta',
    ruta: 'settings',
    permiso: P.preferencias.ver,
    bandera: 'settings',
    pasos: [
      paso('secciones', 'preferencias-secciones'),
      paso('tema', 'preferencias-tema', { antes: navegar('settings', { section: 'appearance' }) }),
      paso('idioma', 'preferencias-idioma'),
      paso('densidad', 'preferencias-densidad'),
      paso('categorias', 'preferencias-categorias', {
        permiso: P.cuentas.categorias.listar,
        antes: navegar('settings', { section: 'categories' }),
      }),
      paso('tutorial', 'preferencias-tutorial', { antes: navegar('settings', { section: 'tutorial' }) }),
    ],
  },
  {
    id: 'organizacion',
    categoria: 'cuenta',
    ruta: 'settings',
    permiso: [P.preferencias.ver, P.organizacion.miembros.listar],
    bandera: 'settings',
    pasos: [
      paso('miembros', 'preferencias-miembros', { antes: navegar('settings', { section: 'organization' }) }),
      paso('correo', 'preferencias-invitar-correo', { permiso: P.organizacion.miembros.crear }),
      paso('rol', 'preferencias-invitar-rol', { permiso: P.organizacion.miembros.crear }),
    ],
  },
  {
    id: 'administracion',
    categoria: 'admin',
    ruta: 'admin',
    permiso: P.administracion.ver,
    bandera: 'admin',
    pasos: [
      paso('titulo', 'admin-titulo', { antes: navegar('admin', { tab: 'summary' }) }),
      paso('usuarios', 'admin-usuarios', {
        permiso: P.administracion.usuarios.listar,
        antes: navegar('admin', { tab: 'users' }),
      }),
      paso('roles-crear', 'admin-roles-crear', {
        permiso: [P.administracion.roles.listar, P.administracion.roles.crear],
        antes: navegar('admin', { tab: 'roles' }),
      }),
      paso('roles', 'admin-roles', { permiso: P.administracion.roles.listar }),
      paso('banderas-buscar', 'admin-banderas-buscar', {
        permiso: P.administracion.banderas.listar,
        antes: navegar('admin', { tab: 'flags' }),
      }),
      paso('banderas', 'admin-banderas', { permiso: P.administracion.banderas.listar }),
      paso('auditoria', 'admin-auditoria-filtros', {
        permiso: P.administracion.auditoria.listar,
        antes: navegar('admin', { tab: 'audit' }),
      }),
      paso('errores-estado', 'admin-errores-estado', {
        permiso: P.administracion.errores.listar,
        antes: navegar('admin', { tab: 'errors' }),
      }),
      paso('errores', 'admin-errores', { permiso: P.administracion.errores.listar }),
    ],
  },
];

const aLista = (permiso: string | string[] | undefined): string[] =>
  permiso === undefined ? [] : Array.isArray(permiso) ? permiso : [permiso];

const cumple = (permiso: string | string[] | undefined, contexto: ContextoDeGuias): boolean =>
  aLista(permiso).every((necesario) => contexto.puede(necesario));

export function guiasDisponibles(contexto: ContextoDeGuias): Guia[] {
  return RECETAS.filter(
    (receta) => cumple(receta.permiso, contexto) && (!receta.bandera || contexto.activa(receta.bandera)),
  ).map((receta) => ({
    id: receta.id,
    categoria: contexto.t(`tutorial.categoria.${receta.categoria}`),
    titulo: contexto.t(`tutorial.guia.${receta.id}.title`),
    resumen: contexto.t(`tutorial.guia.${receta.id}.summary`),
    permiso: receta.permiso,
    bandera: receta.bandera,
    ruta: receta.ruta,
    pasos: receta.pasos
      .filter((p) => cumple(p.permiso, contexto))
      .map((p) => ({
        selector: `[data-tour="${p.tour}"]`,
        titulo: contexto.t(`tutorial.guia.${receta.id}.${p.id}.title`),
        texto: contexto.t(`tutorial.guia.${receta.id}.${p.id}.text`),
        permiso: p.permiso,
        antes: p.antes,
        interactivo: p.interactivo,
      })),
  }));
}

export function selectoresDeGuia(): string[] {
  const selectores = new Set<string>();
  for (const receta of RECETAS)
    for (const p of receta.pasos) {
      selectores.add(`[data-tour="${p.tour}"]`);
      for (const accion of [p.antes ?? []].flat())
        if (accion.tipo === 'clic') {
          selectores.add(accion.selector);
          if (accion.deshacer && accion.deshacer !== 'escape') selectores.add(accion.deshacer);
        }
    }
  return [...selectores];
}
