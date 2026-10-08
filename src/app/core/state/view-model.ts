import { sumBy } from '@core/utils/money';
export interface Movement {
  id: string;
  date: string;
  description: string;
  accountId: string;
  category: string;
  kind: 'income' | 'expense' | 'payment';
  effect?: 'income' | 'expense' | 'neutral';
  anulado?: boolean;
  amount: number;
  status: 'confirmed' | 'pending';
  person?: string;
  ownership?: 'own' | 'loaned';
  recurring?: boolean;
  recurrence?: 'weekly' | 'monthly' | 'yearly';
  installmentCurrent?: number;
  installmentTotal?: number;
  purchaseApr?: number;
  cardBucket?: number;
  loanRole?: 'lent' | 'borrowed' | 'repayment';
  loanProduct?: 'personal' | 'mortgage' | 'vehicle' | 'education' | 'other';
  movementSubtype?: 'transfer' | 'advance';
  originalCurrency?: 'COP' | 'USD';
  originalAmount?: number;
  exchangeRate?: number;
}

export interface Account {
  id: string;
  name: string;
  type: 'savings' | 'checking' | 'cash' | 'wallet' | 'other' | 'credit';
  currency: string;
  openingBalance: number;
  limit?: number;
  lastFour?: string;
  color?: string;
  institution?: string;
  cutDay?: number;
  dueDay?: number;
  exchangeRate?: number;
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
  kind: string;
  title: string;
  detail: string;
  read: boolean;
  createdAt: string;
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

export function accountBalance(account: Account, movements: Movement[]): number {
  return (
    account.openingBalance +
    sumBy(
      movements.filter((movement) => movement.accountId === account.id && movement.status === 'confirmed'),
      (movement) => movement.amount,
    )
  );
}
