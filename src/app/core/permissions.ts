/**
 * Códigos de permiso que emite el servidor.
 *
 * El backend es dueño del vocabulario: resuelve capacidades a esta lista en
 * `CapabilityPermissions.Resolve` y la entrega en `session.permissions`. Aquí solo se
 * les pone nombre para que las plantillas no repitan cadenas literales.
 *
 * Convención: `recurso.subrecurso.accion`, en minúsculas y sin tildes.
 * `ver` es acceder a la pantalla; `listar` es recibir los datos de dentro. Son permisos
 * distintos a propósito: antes entrar a una vista entregaba también su contenido entero.
 *
 * Documentado en `docs/PERMISOS-MATRIZ.md` del repositorio del backend.
 */
export const P = {
  sesion: {
    ver: 'sesion.ver',
    monedas: { listar: 'sesion.monedas.listar' },
  },
  dashboard: {
    ver: 'dashboard.ver',
    listar: 'dashboard.listar',
    tabla: { ver: 'dashboard.tabla.ver' },
    detalle: { ver: 'dashboard.detalle.ver' },
    kpi: {
      balance: 'dashboard.kpi.balance.ver',
      ingresos: 'dashboard.kpi.ingresos.ver',
      gastos: 'dashboard.kpi.gastos.ver',
      recuento: 'dashboard.kpi.recuento.ver',
    },
    widget: {
      editar: 'dashboard.widget.editar',
      crear: 'dashboard.widget.crear',
      flujo: 'dashboard.widget.flujo.ver',
      categorias: 'dashboard.widget.categorias.ver',
      cuentas: 'dashboard.widget.cuentas.ver',
      tendencia: 'dashboard.widget.tendencia.ver',
      compromisos: 'dashboard.widget.compromisos.ver',
      salud: 'dashboard.widget.salud.ver',
      propios: 'dashboard.widget.propios.ver',
    },
  },
  movimientos: {
    ver: 'movimientos.ver',
    listar: 'movimientos.listar',
    crear: 'movimientos.crear',
    editar: 'movimientos.editar',
    deshabilitar: 'movimientos.deshabilitar',
    detalle: { ver: 'movimientos.detalle.ver' },
    clases: { listar: 'movimientos.clases.listar' },
    transferencias: { crear: 'movimientos.transferencias.crear' },
    pagos: { crear: 'movimientos.pagos.crear' },
  },
  cuentas: {
    ver: 'cuentas.ver',
    listar: 'cuentas.listar',
    crear: 'cuentas.crear',
    editar: 'cuentas.editar',
    deshabilitar: 'cuentas.deshabilitar',
    extracto: { ver: 'cuentas.extracto.ver' },
    historial: { ver: 'cuentas.historial.ver' },
    tarjetas: {
      listar: 'cuentas.tarjetas.listar',
      crear: 'cuentas.tarjetas.crear',
      editar: 'cuentas.tarjetas.editar',
    },
    categorias: {
      listar: 'cuentas.categorias.listar',
      crear: 'cuentas.categorias.crear',
      editar: 'cuentas.categorias.editar',
    },
  },
  calendario: {
    ver: 'calendario.ver',
    listar: 'calendario.listar',
    recurrencias: {
      listar: 'calendario.recurrencias.listar',
      crear: 'calendario.recurrencias.crear',
    },
    proyecciones: { crear: 'calendario.proyecciones.crear' },
  },
  personas: {
    ver: 'personas.ver',
    listar: 'personas.listar',
    crear: 'personas.crear',
    editar: 'personas.editar',
    deudas: { listar: 'personas.deudas.listar' },
    obligaciones: { listar: 'personas.obligaciones.listar' },
    compras: { listar: 'personas.compras.listar', crear: 'personas.compras.crear' },
    liquidaciones: { listar: 'personas.liquidaciones.listar', crear: 'personas.liquidaciones.crear' },
  },
  patrimonio: {
    ver: 'patrimonio.ver',
    listar: 'patrimonio.listar',
    inversiones: { crear: 'patrimonio.inversiones.crear', editar: 'patrimonio.inversiones.editar' },
  },
  planificacion: {
    ver: 'planificacion.ver',
    listar: 'planificacion.listar',
  },
  reportes: {
    ver: 'reportes.ver',
    listar: 'reportes.listar',
    exportar: 'reportes.exportar',
    comparativo: { ver: 'reportes.comparativo.ver' },
    categorias: { ver: 'reportes.categorias.ver' },
    tendencia: { ver: 'reportes.tendencia.ver' },
    deuda: { ver: 'reportes.deuda.ver' },
    patrimonio: { ver: 'reportes.patrimonio.ver' },
    hallazgos: { ver: 'reportes.hallazgos.ver' },
  },
  notificaciones: {
    ver: 'notificaciones.ver',
    listar: 'notificaciones.listar',
    editar: 'notificaciones.editar',
  },
  preferencias: {
    ver: 'preferencias.ver',
    listar: 'preferencias.listar',
    editar: 'preferencias.editar',
    tema: { editar: 'preferencias.tema.editar' },
    datos: { eliminar: 'preferencias.datos.eliminar' },
  },
  organizacion: {
    auditoria: { listar: 'organizacion.auditoria.listar' },
    banderas: { listar: 'organizacion.banderas.listar', editar: 'organizacion.banderas.editar' },
    miembros: { listar: 'organizacion.miembros.listar', crear: 'organizacion.miembros.crear' },
  },
  administracion: {
    ver: 'administracion.ver',
    usuarios: {
      listar: 'administracion.usuarios.listar',
      editar: 'administracion.usuarios.editar',
      deshabilitar: 'administracion.usuarios.deshabilitar',
    },
    roles: {
      listar: 'administracion.roles.listar',
      crear: 'administracion.roles.crear',
      editar: 'administracion.roles.editar',
      eliminar: 'administracion.roles.eliminar',
    },
    capacidades: { listar: 'administracion.capacidades.listar' },
    banderas: { listar: 'administracion.banderas.listar', editar: 'administracion.banderas.editar' },
    auditoria: { listar: 'administracion.auditoria.listar' },
    errores: { listar: 'administracion.errores.listar', editar: 'administracion.errores.editar' },
  },
} as const;
