import { P } from './permissions';
/** All amounts are signed COP values. Fixtures never touch a remote service. */
export interface Movement {
  id: string;
  date: string;
  description: string;
  accountId: string;
  category: string;
  kind: 'income' | 'expense' | 'transfer' | 'payment';
  amount: number;
  status: 'confirmed' | 'pending';
  person?: string;
  ownership?: 'own' | 'loaned';
  recurring?: boolean;
  recurrence?: 'weekly' | 'monthly' | 'yearly';
  installmentCurrent?: number;
  installmentTotal?: number;
  loanRole?: 'lent' | 'borrowed' | 'repayment';
  originalCurrency?: 'COP' | 'USD';
  originalAmount?: number;
  exchangeRate?: number;
}

export interface Account {
  id: string;
  name: string;
  type: 'savings' | 'credit' | 'cash';
  currency: string;
  openingBalance: number;
  limit?: number;
  /** Ausente cuando la API no la publica. No se inventa un «0000». */
  lastFour?: string;
  color?: string;
  institution?: string;
  cutDay?: number;
  dueDay?: number;
  exchangeRate?: number;
  /**
   * Tasa anual de compras de una tarjeta, en porcentaje. Ausente cuando no se conoce:
   * no se sustituye por una constante, que es lo que hacia la pantalla del extracto.
   */
  annualRate?: number;
}

export type PersonRelationship = 'Familia' | 'Amistad' | 'Trabajo' | 'Cliente' | 'Proveedor' | 'Otro';

export interface Person {
  id: string;
  name: string;
  owed: number;
  owing: number;
  /** Ausente mientras la API no la publique: mostrarla como «Otro» era inventarla. */
  relationship?: PersonRelationship;
  email?: string;
  averagePaymentDays?: number;
  paymentDelayDeviation?: number;
  latePayments?: number;
}
export interface Investment {
  id: string;
  name: string;
  type: string;
  value: number;
  cost: number;
  currency: string;
  /** Los cuatro siguientes faltan en el contrato actual. Ausente ≠ cero ni «Medio». */
  institution?: string;
  units?: number;
  risk?: 'Bajo' | 'Medio' | 'Alto';
  liquidity?: 'Inmediata' | 'Programada' | 'Al vencimiento';
  maturityDate?: string;
  annualRate?: number;
  fees?: number;
}
export interface DemoAuditEvent {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  result: 'Exitoso' | 'Rechazado';
}
export interface DemoNotification {
  id: string;
  title: string;
  detail: string;
  read: boolean;
}
export interface DemoData {
  movements: Movement[];
  accounts: Account[];
  people: Person[];
  investments: Investment[];
  notifications: DemoNotification[];
  auditEvents: DemoAuditEvent[];
  featureFlags: Record<string, boolean>;
}

export function createEmptyData(): DemoData {
  return {
    movements: [],
    accounts: [],
    people: [],
    investments: [],
    notifications: [],
    auditEvents: [],
    featureFlags: {},
  };
}

/**
 * Perfiles del modo demo. Llevan los mismos códigos que emite el servidor, para que
 * probar sin API ejercite exactamente las mismas comprobaciones que en producción.
 * Daniel es de solo lectura: sirve para ver qué desaparece sin permisos de escritura.
 */
export const demoUsers = [
  {
    id: 'demo-owner',
    name: 'Valentina Torres',
    email: 'valentina@example.test',
    capabilities: [
      P.sesion.ver,
      P.sesion.monedas.listar,
      P.dashboard.ver,
      P.dashboard.tabla.ver,
      P.dashboard.detalle.ver,
      P.dashboard.kpi.balance,
      P.dashboard.kpi.ingresos,
      P.dashboard.kpi.gastos,
      P.dashboard.kpi.recuento,
      P.dashboard.widget.editar,
      P.dashboard.widget.crear,
      P.dashboard.widget.deshabilitar,
      P.dashboard.widget.orden.editar,
      P.dashboard.widget.tipo.editar,
      P.dashboard.widget.flujo,
      P.dashboard.widget.categorias,
      P.dashboard.widget.cuentas,
      P.dashboard.widget.tendencia,
      P.dashboard.widget.compromisos,
      P.dashboard.widget.salud,
      P.dashboard.widget.propios,
      P.movimientos.ver,
      P.movimientos.detalle.ver,
      P.movimientos.clases.listar,
      P.movimientos.crear,
      P.movimientos.editar,
      P.movimientos.deshabilitar,
      P.movimientos.exportar,
      P.movimientos.transferencias.crear,
      P.movimientos.prestamos.crear,
      P.movimientos.creditos.crear,
      P.movimientos.pagos.crear,
      P.cuentas.ver,
      P.cuentas.crear,
      P.cuentas.ahorro.crear,
      P.cuentas.efectivo.crear,
      P.cuentas.editar,
      P.cuentas.deshabilitar,
      P.cuentas.extracto.ver,
      P.cuentas.historial.ver,
      P.cuentas.tarjetas.listar,
      P.cuentas.tarjetas.crear,
      P.cuentas.tarjetas.editar,
      P.cuentas.categorias.listar,
      P.cuentas.categorias.crear,
      P.cuentas.categorias.editar,
      P.calendario.ver,
      P.calendario.recurrencias.listar,
      P.calendario.recurrencias.crear,
      P.calendario.proyecciones.crear,
      P.personas.ver,
      P.personas.crear,
      P.personas.editar,
      P.personas.deudas.listar,
      P.personas.deudas.crear,
      P.personas.prestamos.crear,
      P.personas.obligaciones.listar,
      P.personas.compras.listar,
      P.personas.compras.crear,
      P.personas.liquidaciones.listar,
      P.personas.liquidaciones.crear,
      P.patrimonio.ver,
      P.patrimonio.inversiones.crear,
      P.patrimonio.inversiones.editar,
      P.planificacion.ver,
      P.planificacion.deudas.ver,
      P.planificacion.compras.ver,
      P.planificacion.vacaciones.ver,
      P.planificacion.inversiones.ver,
      P.reportes.ver,
      P.reportes.exportar,
      P.reportes.comparativo.ver,
      P.reportes.categorias.ver,
      P.reportes.tendencia.ver,
      P.reportes.deuda.ver,
      P.reportes.patrimonio.ver,
      P.reportes.hallazgos.ver,
      P.notificaciones.ver,
      P.notificaciones.editar,
      P.preferencias.ver,
      P.preferencias.editar,
      P.preferencias.tema.editar,
      P.preferencias.datos.eliminar,
      P.organizacion.auditoria.listar,
      P.organizacion.banderas.listar,
      P.organizacion.banderas.editar,
      P.organizacion.miembros.listar,
      P.organizacion.miembros.crear,
      P.administracion.ver,
      P.administracion.usuarios.listar,
      P.administracion.usuarios.editar,
      P.administracion.usuarios.deshabilitar,
      P.administracion.roles.listar,
      P.administracion.roles.crear,
      P.administracion.roles.editar,
      P.administracion.roles.eliminar,
      P.administracion.capacidades.listar,
      P.administracion.banderas.listar,
      P.administracion.banderas.editar,
      P.administracion.auditoria.listar,
      P.administracion.errores.listar,
      P.administracion.errores.editar,
    ] as string[],
  },
  {
    id: 'demo-reviewer',
    name: 'Daniel Ríos',
    email: 'daniel@example.test',
    capabilities: [
      P.sesion.ver,
      P.sesion.monedas.listar,
      P.dashboard.ver,
      P.dashboard.tabla.ver,
      P.dashboard.detalle.ver,
      P.dashboard.kpi.balance,
      P.dashboard.kpi.ingresos,
      P.dashboard.kpi.gastos,
      P.dashboard.kpi.recuento,
      P.dashboard.widget.flujo,
      P.dashboard.widget.categorias,
      P.dashboard.widget.cuentas,
      P.dashboard.widget.tendencia,
      P.dashboard.widget.propios,
      P.dashboard.widget.orden.editar,
      P.movimientos.ver,
      P.movimientos.detalle.ver,
      P.movimientos.clases.listar,
      P.movimientos.exportar,
      P.cuentas.ver,
      P.cuentas.extracto.ver,
      P.cuentas.historial.ver,
      P.cuentas.tarjetas.listar,
      P.cuentas.categorias.listar,
      P.calendario.ver,
      P.reportes.ver,
      P.reportes.comparativo.ver,
      P.reportes.categorias.ver,
      P.reportes.tendencia.ver,
      P.notificaciones.ver,
      P.notificaciones.editar,
      P.preferencias.ver,
      P.preferencias.editar,
    ] as string[],
  },
];

/** Pending authorizations are visible but do not change the posted balance. */
export function accountBalance(account: Account, movements: Movement[]): number {
  return (
    account.openingBalance +
    movements.reduce(
      (total, movement) =>
        total + (movement.accountId === account.id && movement.status === 'confirmed' ? movement.amount : 0),
      0,
    )
  );
}

/** Twelve full calendar months, with repeatable values and balanced transfer/payment legs. */
export function createDemoData(): DemoData {
  const accounts: Account[] = [
    {
      id: 'savings-main',
      name: 'Ahorros principal',
      type: 'savings',
      currency: 'COP',
      openingBalance: 5200000,
      lastFour: '2048',
      color: '#0f766e',
    },
    {
      id: 'savings-goals',
      name: 'Ahorros para metas',
      type: 'savings',
      currency: 'COP',
      openingBalance: 2800000,
      lastFour: '9012',
      color: '#2563eb',
    },
    {
      id: 'credit-emerald',
      name: 'Visa Esmeralda',
      type: 'credit',
      currency: 'COP',
      openingBalance: -1450000,
      limit: 8000000,
      lastFour: '4821',
      color: '#047857',
      cutDay: 15,
      dueDay: 5,
    },
    {
      id: 'credit-indigo',
      name: 'Mastercard Índigo',
      type: 'credit',
      currency: 'USD',
      openingBalance: -780000,
      limit: 5000000,
      lastFour: '7506',
      color: '#4338ca',
      cutDay: 22,
      dueDay: 12,
      exchangeRate: 4168.35,
    },
    {
      id: 'credit-copper',
      name: 'Visa Cobre',
      type: 'credit',
      currency: 'COP',
      openingBalance: -320000,
      limit: 3000000,
      lastFour: '1639',
      color: '#b45309',
      cutDay: 28,
      dueDay: 18,
    },
    {
      id: 'cash',
      name: 'Efectivo',
      type: 'cash',
      currency: 'COP',
      openingBalance: 240000,
      lastFour: '0000',
      color: '#64748b',
    },
  ];
  const movements: Movement[] = [];
  const add = (
    month: number,
    day: number,
    accountId: string,
    description: string,
    category: string,
    kind: Movement['kind'],
    amount: number,
    person?: string,
    status: Movement['status'] = 'confirmed',
    details: Partial<Movement> = {},
  ) => {
    const date = new Date(Date.UTC(2025, 8 + month, day)).toISOString().slice(0, 10);
    movements.push({
      id: `mov-${String(movements.length + 1).padStart(4, '0')}`,
      date,
      accountId,
      description,
      category,
      kind,
      amount,
      status,
      ...(person ? { person } : {}),
      ownership: person ? 'loaned' : 'own',
      ...details,
    });
  };
  for (let month = 0; month < 12; month++) {
    add(month, 1, 'savings-main', 'Nómina mensual', 'Salario', 'income', 6800000);
    add(month, 2, 'savings-main', 'Arriendo apartamento', 'Vivienda', 'expense', -1650000, undefined, 'confirmed', {
      recurring: true,
      recurrence: 'monthly',
    });
    add(
      month,
      3,
      'savings-main',
      'Servicios e internet',
      'Servicios',
      'expense',
      -(245000 + month * 1500),
      undefined,
      'confirmed',
      { recurring: true, recurrence: 'monthly' },
    );
    add(month, 4, 'savings-main', 'Aporte a vacaciones', 'Transferencias', 'transfer', -450000);
    add(month, 4, 'savings-goals', 'Aporte a vacaciones', 'Transferencias', 'transfer', 450000);
    add(month, 5, 'savings-main', 'Retiro para efectivo', 'Transferencias', 'transfer', -180000);
    add(month, 5, 'cash', 'Retiro para efectivo', 'Transferencias', 'transfer', 180000);
    for (let week = 0; week < 4; week++) {
      const day = 6 + week * 6;
      add(
        month,
        day,
        'credit-emerald',
        'Mercado semanal',
        'Alimentación',
        'expense',
        -(135000 + ((month + week) % 5) * 7500),
      );
      add(
        month,
        day,
        'credit-indigo',
        'Transporte y movilidad',
        'Transporte',
        'expense',
        -(42000 + week * 3000),
        undefined,
        'confirmed',
        {
          originalCurrency: 'USD',
          originalAmount: Number(((42000 + week * 3000) / 4168.35).toFixed(2)),
          exchangeRate: 4168.35,
        },
      );
      add(month, day, 'cash', 'Café y almuerzo', 'Alimentación', 'expense', -(26000 + week * 1000));
      add(month, day + 1, 'savings-main', 'Compras del hogar', 'Hogar', 'expense', -(54000 + month * 1000));
    }
    add(month, 10, 'credit-copper', 'Suscripción música', 'Suscripciones', 'expense', -24900, undefined, 'confirmed', {
      recurring: true,
      recurrence: 'monthly',
    });
    add(month, 10, 'credit-copper', 'Suscripción almacenamiento', 'Suscripciones', 'expense', -12900);
    add(
      month,
      12,
      'credit-indigo',
      'Compra compartida · Ana',
      'Compras prestadas',
      'expense',
      -95000,
      'Ana Martínez',
      'confirmed',
      { originalCurrency: 'USD', originalAmount: 22.79, exchangeRate: 4168.35 },
    );
    add(
      month,
      14,
      'savings-main',
      'Reembolso compra · Ana',
      'Reembolsos',
      'income',
      95000,
      'Ana Martínez',
      'confirmed',
      { loanRole: 'repayment' },
    );
    add(
      month,
      18,
      'savings-main',
      'Abono préstamo · Carlos',
      'Préstamos',
      'income',
      100000,
      'Carlos Gómez',
      'confirmed',
      { loanRole: 'repayment' },
    );
    for (const [card, day, amount] of [
      ['credit-emerald', 20, 610000],
      ['credit-indigo', 23, 260000],
      ['credit-copper', 25, 37800],
    ] as const) {
      add(month, day, 'savings-main', `Abono ${card}`, 'Pago de tarjeta', 'payment', -amount);
      add(month, day, card, `Abono ${card}`, 'Pago de tarjeta', 'payment', amount);
    }
    if (month % 3 === 0) add(month, 27, 'savings-main', 'Proyecto independiente', 'Honorarios', 'income', 920000);
  }
  add(
    0,
    8,
    'savings-main',
    'Préstamo otorgado · Carlos',
    'Préstamos',
    'expense',
    -2000000,
    'Carlos Gómez',
    'confirmed',
    { loanRole: 'lent' },
  );
  for (let installment = 1; installment <= 6; installment++)
    add(
      4 + installment - 1,
      16,
      'credit-emerald',
      'Computador portátil',
      'Tecnología',
      'expense',
      -300000,
      undefined,
      'confirmed',
      { installmentCurrent: installment, installmentTotal: 6 },
    );
  add(5, 17, 'credit-emerald', 'Devolución parcial de accesorio', 'Devoluciones', 'income', 120000);
  add(6, 9, 'savings-main', 'Constitución CDT', 'Inversiones', 'expense', -3000000);
  add(7, 11, 'savings-main', 'Aporte a fondo de inversión', 'Inversiones', 'expense', -1500000);
  add(
    11,
    28,
    'credit-indigo',
    'Reserva hotel · pendiente de confirmación',
    'Viajes',
    'expense',
    -420000,
    undefined,
    'pending',
  );
  add(11, 29, 'credit-copper', 'Compra prestada · Laura', 'Compras prestadas', 'expense', -185000, 'Laura Méndez');
  return {
    accounts,
    movements: movements.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    people: [
      {
        id: 'carlos',
        name: 'Carlos Gómez',
        owed: 800000,
        owing: 0,
        relationship: 'Familia',
        email: 'carlos@example.test',
        averagePaymentDays: 8,
        paymentDelayDeviation: 3.2,
        latePayments: 1,
      },
      {
        id: 'ana',
        name: 'Ana Martínez',
        owed: 0,
        owing: 0,
        relationship: 'Amistad',
        email: 'ana@example.test',
        averagePaymentDays: 3,
        paymentDelayDeviation: 1.1,
        latePayments: 0,
      },
      {
        id: 'laura',
        name: 'Laura Méndez',
        owed: 185000,
        owing: 0,
        relationship: 'Trabajo',
        email: 'laura@example.test',
        averagePaymentDays: 17,
        paymentDelayDeviation: 6.4,
        latePayments: 3,
      },
    ],
    investments: [
      {
        id: 'cdt',
        name: 'CDT · ahorro a plazo',
        type: 'CDT',
        cost: 3000000,
        value: 3120000,
        institution: 'Banco Central',
        currency: 'COP',
        units: 1,
        risk: 'Bajo',
        liquidity: 'Al vencimiento',
        maturityDate: '2027-03-09',
        annualRate: 10.2,
        fees: 0,
      },
      {
        id: 'fund',
        name: 'Fondo conservador',
        type: 'Fondo',
        cost: 1500000,
        value: 1538000,
        institution: 'Fiduciaria Nacional',
        currency: 'COP',
        units: 1538,
        risk: 'Medio',
        liquidity: 'Programada',
        annualRate: 7.8,
        fees: 12500,
      },
    ],
    notifications: [
      {
        id: 'notice-purchase',
        title: 'Compra detectada para revisar',
        detail: 'Reserva de hotel por $420.000 pendiente de revisión.',
        read: false,
      },
      {
        id: 'notice-cut',
        title: 'Revisa tu próximo corte',
        detail: 'Visa Esmeralda: consulta movimientos y simula un abono.',
        read: false,
      },
      {
        id: 'notice-review',
        title: 'Revisión de agosto disponible',
        detail: 'Tu historial financiero se encuentra actualizado.',
        read: true,
      },
    ],
    featureFlags: {
      'planning.purchase': true,
      'planning.vacations': true,
      'portfolio.analytics': true,
      'reports.people-ranking': false,
    },
    auditEvents: [
      {
        id: 'audit-1',
        createdAt: '2026-08-31T14:42:00Z',
        actor: 'Valentina Torres',
        action: 'Creó movimiento',
        module: 'Movimientos',
        entityType: 'Movimiento',
        entityId: 'mov-0412',
        result: 'Exitoso',
      },
      {
        id: 'audit-2',
        createdAt: '2026-08-31T14:18:00Z',
        actor: 'Daniel Ríos',
        action: 'Consultó reporte',
        module: 'Reportes',
        entityType: 'Reporte',
        entityId: 'cash-flow',
        result: 'Exitoso',
      },
      {
        id: 'audit-3',
        createdAt: '2026-08-30T21:05:00Z',
        actor: 'Valentina Torres',
        action: 'Editó inversión',
        module: 'Patrimonio',
        entityType: 'Inversión',
        entityId: 'fund',
        result: 'Exitoso',
      },
      {
        id: 'audit-4',
        createdAt: '2026-08-30T18:12:00Z',
        actor: 'Daniel Ríos',
        action: 'Intentó cambiar permisos',
        module: 'Administración',
        entityType: 'Permiso',
        entityId: 'theme.customize',
        result: 'Rechazado',
      },
      {
        id: 'audit-5',
        createdAt: '2026-08-29T13:10:00Z',
        actor: 'Sistema',
        action: 'Procesó recurrencias',
        module: 'Movimientos',
        entityType: 'Proceso',
        entityId: 'recurrence-daily',
        result: 'Exitoso',
      },
    ],
  };
}
