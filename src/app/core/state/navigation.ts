import { P } from '../session/permissions';

/** La capacidad de cada entrada es el permiso `<recurso>.ver` de la matriz. */
export const navigation = [
  { path: 'dashboard', label: 'Dashboard', icon: 'dashboard', group: 'overview', capability: P.dashboard.ver },
  { path: 'movements', label: 'Movimientos', icon: 'movements', group: 'money', capability: P.movimientos.ver },
  { path: 'calendar', label: 'Calendario', icon: 'calendar', group: 'money', capability: P.calendario.ver },
  { path: 'accounts', label: 'Cuentas y tarjetas', icon: 'accounts', group: 'money', capability: P.cuentas.ver },
  { path: 'people', label: 'Personas y deudas', icon: 'people', group: 'money', capability: P.personas.ver },
  { path: 'portfolio', label: 'Patrimonio', icon: 'portfolio', group: 'money', capability: P.patrimonio.ver },
  { path: 'planning', label: 'Planificación', icon: 'planning', group: 'analysis', capability: P.planificacion.ver },
  { path: 'reports', label: 'Reportes', icon: 'reports', group: 'analysis', capability: P.reportes.ver },
  {
    path: 'notifications',
    label: 'Notificaciones',
    icon: 'notifications',
    group: 'workspace',
    capability: P.notificaciones.ver,
  },
  { path: 'admin', label: 'Administración', icon: 'admin', group: 'workspace', capability: P.administracion.ver },
  { path: 'settings', label: 'Preferencias', icon: 'settings', group: 'workspace', capability: P.preferencias.ver },
];
