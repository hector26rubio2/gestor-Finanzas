/**
 * Códigos de permiso que emite el servidor.
 *
 * El backend es dueño del vocabulario: resuelve capacidades a esta lista en
 * `CapabilityPermissions.Resolve` y la entrega en `session.permissions`. Aquí solo se
 * les pone nombre para que las plantillas no repitan cadenas literales.
 *
 * Convención: `recurso.subrecurso.accion`, en minúsculas y sin tildes.
 *
 * `X.ver` es la funcionalidad entera: pone el recurso en el menú lateral, abre su ruta y
 * entrega su listado. Los demás códigos son las acciones de dentro, y cada uno responde
 * solo por su parte, sin depender de ningún otro: marcar un KPI del dashboard muestra ese
 * KPI. Hubo una época en que además hacía falta un `X.listar`, y no marcarlo dejaba la
 * pantalla en blanco: la entrada aparecía en el menú y dentro no había nada.
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
      deshabilitar: 'dashboard.widget.deshabilitar',
      orden: { editar: 'dashboard.widget.orden.editar' },
      tipo: { editar: 'dashboard.widget.tipo.editar' },
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
    crear: 'movimientos.crear',
    editar: 'movimientos.editar',
    deshabilitar: 'movimientos.deshabilitar',
    detalle: { ver: 'movimientos.detalle.ver' },
    clases: { listar: 'movimientos.clases.listar' },
    exportar: 'movimientos.exportar',
    transferencias: { crear: 'movimientos.transferencias.crear' },
    prestamos: { crear: 'movimientos.prestamos.crear' },
    creditos: { crear: 'movimientos.creditos.crear' },
    pagos: { crear: 'movimientos.pagos.crear' },
  },
  cuentas: {
    ver: 'cuentas.ver',
    crear: 'cuentas.crear',
    editar: 'cuentas.editar',
    deshabilitar: 'cuentas.deshabilitar',
    ahorro: { crear: 'cuentas.ahorro.crear' },
    efectivo: { crear: 'cuentas.efectivo.crear' },
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
    recurrencias: {
      listar: 'calendario.recurrencias.listar',
      crear: 'calendario.recurrencias.crear',
    },
    proyecciones: { crear: 'calendario.proyecciones.crear' },
  },
  personas: {
    ver: 'personas.ver',
    crear: 'personas.crear',
    editar: 'personas.editar',
    deudas: { listar: 'personas.deudas.listar', crear: 'personas.deudas.crear' },
    prestamos: { crear: 'personas.prestamos.crear' },
    obligaciones: { listar: 'personas.obligaciones.listar' },
    compras: { listar: 'personas.compras.listar', crear: 'personas.compras.crear' },
    liquidaciones: { listar: 'personas.liquidaciones.listar', crear: 'personas.liquidaciones.crear' },
  },
  patrimonio: {
    ver: 'patrimonio.ver',
    inversiones: { crear: 'patrimonio.inversiones.crear', editar: 'patrimonio.inversiones.editar' },
  },
  planificacion: {
    ver: 'planificacion.ver',
    deudas: { ver: 'planificacion.deudas.ver' },
    compras: { ver: 'planificacion.compras.ver' },
    vacaciones: { ver: 'planificacion.vacaciones.ver' },
    inversiones: { ver: 'planificacion.inversiones.ver' },
  },
  reportes: {
    ver: 'reportes.ver',
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
    editar: 'notificaciones.editar',
  },
  preferencias: {
    ver: 'preferencias.ver',
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
