import { P } from '@core/session/permissions';

export interface PasoDelTutorial {
  selector: string;
  titulo: string;
  texto: string;
}

export interface ContextoDeTutorial {
  t: (clave: string) => string;
  puede: (permiso: string) => boolean;
}

interface RecetaDePaso {
  id: string;
  permiso?: string;
}

const ARMAZON: readonly RecetaDePaso[] = [
  { id: 'navegacion' },
  { id: 'buscar' },
  { id: 'nuevo-movimiento', permiso: P.movimientos.crear },
  { id: 'notificaciones' },
  { id: 'perfil' },
  { id: 'reportar' },
];

const POR_SECCION: Readonly<Record<string, readonly RecetaDePaso[]>> = {
  dashboard: [
    { id: 'dashboard-vista' },
    { id: 'dashboard-periodo' },
    { id: 'dashboard-filtros' },
    { id: 'dashboard-personalizar', permiso: P.dashboard.widget.orden.editar },
  ],
  movements: [
    { id: 'movimientos-kpis' },
    { id: 'tabla-busqueda' },
    { id: 'tabla-filtros' },
    { id: 'tabla-columnas' },
    { id: 'movimientos-tabla' },
    { id: 'movimientos-exportar', permiso: P.movimientos.exportar },
  ],
  calendar: [
    { id: 'calendario-anterior' },
    { id: 'calendario-vistas' },
    { id: 'calendario-hoy' },
    { id: 'calendario-siguiente' },
    { id: 'calendario-agenda' },
    { id: 'calendario-recurrentes' },
  ],
  accounts: [
    { id: 'cuentas-nueva', permiso: P.cuentas.crear },
    { id: 'cuentas-tarjetas' },
    { id: 'cuentas-abono', permiso: P.movimientos.pagos.crear },
    { id: 'cuentas-tabla' },
  ],
  people: [{ id: 'personas-nueva', permiso: P.personas.crear }, { id: 'personas-tabla' }],
  portfolio: [{ id: 'inversiones-nueva', permiso: P.patrimonio.inversiones.crear }, { id: 'inversiones-tabla' }],
  planning: [
    { id: 'planificacion-pestanas' },
    { id: 'planificacion-parametros' },
    { id: 'planificacion-escenarios' },
    { id: 'planificacion-resultados' },
  ],
  reports: [
    { id: 'reportes-pestanas' },
    { id: 'reportes-periodo' },
    { id: 'reportes-exportar', permiso: P.reportes.exportar },
  ],
  notifications: [{ id: 'notificaciones-filtro' }, { id: 'notificaciones-marcar', permiso: P.notificaciones.editar }],
  settings: [{ id: 'preferencias-secciones' }, { id: 'preferencias-tutorial' }],
};

export function pasosDe(seccion: string, contexto: ContextoDeTutorial): PasoDelTutorial[] {
  return [...ARMAZON, ...(POR_SECCION[seccion] ?? [])]
    .filter((receta) => !receta.permiso || contexto.puede(receta.permiso))
    .map((receta) => ({
      selector: `[data-tour="${receta.id}"]`,
      titulo: contexto.t(`tutorial.step.${receta.id}.title`),
      texto: contexto.t(`tutorial.step.${receta.id}.text`),
    }));
}
