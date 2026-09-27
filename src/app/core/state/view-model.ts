import { sumBy } from '@core/utils/money';
/** All amounts are signed COP values. Fixtures never touch a remote service. */
export interface Movement {
  id: string;
  date: string;
  description: string;
  accountId: string;
  category: string;
  kind: 'income' | 'expense' | 'payment';
  amount: number;
  status: 'confirmed' | 'pending';
  person?: string;
  ownership?: 'own' | 'loaned';
  recurring?: boolean;
  recurrence?: 'weekly' | 'monthly' | 'yearly';
  installmentCurrent?: number;
  installmentTotal?: number;
  /**
   * Tasa anual propia de esta compra a cuotas, en porcentaje. Puede cambiar mes a mes
   * aunque la tarjeta no cambie la suya; ausente usa la de la tarjeta (`Account.annualRate`).
   */
  purchaseApr?: number;
  cardBucket?: number;
  loanRole?: 'lent' | 'borrowed' | 'repayment';
  /** Solo cuando es un crédito formal del banco (no un préstamo con una persona). */
  loanProduct?: 'personal' | 'mortgage' | 'vehicle' | 'education' | 'other';
  /**
   * Una transferencia o un avance de tarjeta no es su propia clase de movimiento: la
   * pata que sale es un gasto y la que entra un ingreso, igual que cualquiera. Esta es
   * la única marca que los distingue de una compra o un sueldo normal, y es lo que
   * excluyen los KPI y el filtro de Operación para no contarlos como plata ganada o
   * gastada de verdad — el dinero solo se movió entre cuentas propias (o entre la
   * tarjeta y una cuenta propia, en el avance).
   */
  movementSubtype?: 'transfer' | 'advance';
  originalCurrency?: 'COP' | 'USD';
  originalAmount?: number;
  exchangeRate?: number;
}

export interface Account {
  id: string;
  name: string;
  /**
   * Los cinco tipos del contrato (`AccountKindDto`) más la tarjeta. Antes solo había
   * `savings | credit | cash` y una cuenta corriente, una billetera o una «otra» llegaba
   * aquí convertida en ahorro.
   */
  type: 'savings' | 'checking' | 'cash' | 'wallet' | 'other' | 'credit';
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
  issuerId?: string;
  paymentPriority?: readonly number[];
  foreignPaymentPriority?: readonly number[];
  monthlyFee?: number;
  dualCurrency?: boolean;
}

export type PersonRelationship = 'Familia' | 'Amistad' | 'Trabajo' | 'Cliente' | 'Proveedor' | 'Otro';

export type PersonKind = 'person' | 'institution';

export interface Person {
  id: string;
  name: string;
  kind?: PersonKind;
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
export interface AuditEvent {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  result: 'Exitoso' | 'Rechazado';
}
export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  read: boolean;
}
export interface ViewData {
  movements: Movement[];
  accounts: Account[];
  people: Person[];
  investments: Investment[];
  notifications: AppNotification[];
  auditEvents: AuditEvent[];
  featureFlags: Record<string, boolean>;
}

export function createEmptyData(): ViewData {
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

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  capabilities: string[];
  photoUrl?: string;
}

/** Pending authorizations are visible but do not change the posted balance. */
export function accountBalance(account: Account, movements: Movement[]): number {
  return (
    account.openingBalance +
    sumBy(
      movements.filter((movement) => movement.accountId === account.id && movement.status === 'confirmed'),
      (movement) => movement.amount,
    )
  );
}
