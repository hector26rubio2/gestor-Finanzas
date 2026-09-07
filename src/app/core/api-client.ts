import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { RUNTIME_CONFIG } from './runtime';

/**
 * Transport boundary for the future API. Feature code depends on repositories,
 * never on HttpClient or endpoint strings. The demo remains the active provider.
 */
export interface ApiRequest<TBody = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: TBody;
  params?: Readonly<Record<string, string | number | boolean | undefined>>;
}

export interface ApiTransport {
  request<TResponse, TBody = unknown>(request: ApiRequest<TBody>): Observable<TResponse>;
}

export const API_TRANSPORT = new InjectionToken<ApiTransport>('API_TRANSPORT');

export interface ApiProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ApiProblem,
  ) {
    super(problem.detail || problem.title || `La API respondió ${status}.`);
  }
}

@Injectable()
export class HttpApiTransport implements ApiTransport {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  request<TResponse, TBody = unknown>(request: ApiRequest<TBody>): Observable<TResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(request.params ?? {})) {
      if (value !== undefined) params = params.set(key, String(value));
    }
    if (this.config.mode !== 'api' || !this.config.apiBaseUrl)
      return throwError(() => new Error('El transporte HTTP no está activo en modo demo.'));
    const unsafe = request.method !== 'GET';
    const send = (csrfToken?: string) => {
      let headers = new HttpHeaders({ Accept: 'application/json' });
      if (csrfToken) headers = headers.set('X-CSRF-Token', csrfToken);
      return this.http.request<TResponse>(request.method, `${this.config.apiBaseUrl}${request.path}`, {
        body: request.body,
        params,
        headers,
        context: new HttpContext(),
        withCredentials: true,
      });
    };
    const response$ = unsafe
      ? this.http
          .get<{ token: string }>(`${this.config.apiBaseUrl}${API_ROUTES.csrf}`, { withCredentials: true })
          .pipe(switchMap(({ token }) => send(token)))
      : send();
    return response$.pipe(
      catchError((error: HttpErrorResponse) =>
        throwError(() => new ApiRequestError(error.status, (error.error ?? {}) as ApiProblem)),
      ),
    );
  }
}

export interface ApiPage<T> {
  items: readonly T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface MovementQuery {
  page: number;
  pageSize: number;
  period?: string;
  accountId?: string;
  search?: string;
}

/** API-facing money never uses JavaScript floating point. */
export interface ApiMoney {
  amount: string;
  currency: string;
}

export interface ApiMovementSummary {
  id: string;
  occurredOn: string;
  description: string;
  accountId: string;
  kind: string;
  flow: string;
  effect: string;
  money: ApiMoney;
  status: string;
}

export interface ApiUser {
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
}

export interface ApiOrganization {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiSession {
  user: ApiUser;
  organization: ApiOrganization;
  capabilities: readonly number[];
  organizations: readonly ApiOrganization[];
  expiresAt: string;
  isSuperAdmin?: boolean;
  permissions?: readonly string[];
}

export const ApiCapability = {
  viewLedger: 1,
  recordMovements: 2,
  manageAccounts: 4,
  manageCards: 8,
  managePeople: 16,
  manageInvestments: 32,
  manageRecurrences: 64,
  issueSettlements: 128,
  exportData: 256,
  manageMembers: 512,
  manageOrganization: 1024,
  viewDashboard: 2048,
  viewMovements: 4096,
  viewAccounts: 8192,
} as const;

export interface ApiAccount {
  id: string;
  name: string;
  kind: number;
  currency: string;
  institution: string | null;
  lastFour: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ApiLinkRef {
  id: string;
  name: string;
}

export interface ApiConvertedMoney {
  original: ApiMoney;
  base: ApiMoney;
  rate: string;
  rateAsOf: string;
}

export interface ApiMovement {
  id: string;
  date: string;
  kind: number;
  effect: number;
  flow: number;
  amount: ApiConvertedMoney;
  links: Readonly<Record<string, string | null>>;
  linkNames: Readonly<Record<string, ApiLinkRef | null>>;
  origin: number;
  description: string | null;
  createdAt: string;
  reversalOf: string | null;
  reversedBy: string | null;
}

export interface ApiCard {
  id: string;
  name: string;
  currency: string;
  creditLimit: ApiMoney;
  cycle: { statementDay: number; paymentDueDay: number };
  issuer: string | null;
  lastFour: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiCounterparty {
  id: string;
  displayName: string;
  alias: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiDebtPosition {
  counterparty: ApiLinkRef;
  ownDebt: ApiMoney;
  receivable: ApiMoney;
  asOf: string;
}

export interface ApiInvestment {
  id: string;
  name: string;
  instrumentType: string;
  currency: string;
  costBasis: ApiMoney;
  marketValue: ApiMoney | null;
  isActive: boolean;
}

export interface ApiDashboard {
  period: { income: ApiMoney; expense: ApiMoney; net: ApiMoney; period: { start: string; end: string } };
  accounts: readonly { account: ApiLinkRef; balance: ApiMoney; asOf: string }[];
  cards: readonly unknown[];
  topCategories: readonly unknown[];
  asOf: string;
}

export interface ApiOperation {
  id: string;
  kind: number;
  date: string;
  description: string | null;
  createdAt: string;
  legs: readonly ApiMovement[];
}
export interface ApiAccountOpening {
  account: ApiAccount;
  openingMovement: ApiMovement;
}
export interface ApiPreference {
  userId: string;
  language: string;
  theme: string;
  font: string;
  density: string;
  baseCurrency: string;
  customThemeJson: string | null;
  updatedAt: string;
}
export interface ApiFeatureFlag {
  key: string;
  isEnabled: boolean;
  audienceJson: string | null;
  updatedAt: string;
}
export interface ApiCategory {
  id: string;
  name: string;
  type: number;
  color: string;
  icon: string;
  parent: string | null;
  isActive: boolean;
  createdAt: string;
}
export interface ApiNotification {
  id: string;
  kind: string;
  title: string;
  payloadJson: string;
  readAt: string | null;
  createdAt: string;
}
export interface ApiAuditEvent {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  traceId: string;
  changesJson: string | null;
  createdAt: string;
}
export interface ApiAdminUser {
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
  lastSeenAt: string | null;
  roles: readonly string[];
  capabilities: readonly string[];
  isSuperAdmin?: boolean;
  createdAt?: string;
  memberships?: readonly {
    id: string;
    organizationId: string;
    organizationName: string;
    status: string;
    effectiveCapabilities: readonly string[];
    roles: readonly ApiAdminRole[];
  }[];
}
export interface ApiAdminRole {
  id: string;
  name: string;
  description: string | null;
  organizationId?: string;
  capabilities: readonly string[];
  isSystem: boolean;
}
export interface ApiCapabilityDescriptor {
  key: string;
  module: string;
  description: string;
}
export interface ApiAdminFeatureFlag {
  key: string;
  organizationId: string | null;
  userId: string | null;
  isEnabled: boolean;
  updatedAt: string;
}
export interface ApiClientError {
  id: string;
  fingerprint: string;
  message: string;
  source: 'web' | 'desktop' | 'api';
  status: 'new' | 'investigating' | 'resolved';
  occurrences: number;
  affectedUsers: number;
  version: string;
  lastSeenAt: string;
  traceId: string | null;
  organizationId?: string | null;
  userId?: string | null;
  contextJson?: string | null;
  resolution?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
}
export interface ApiRecurrence {
  id: string;
  name: string;
  kind: number;
  movementTemplate: number | null;
  amount: ApiMoney;
  target: Readonly<Record<string, string | null>>;
  sourceAccount: string | null;
  destinationAccount: string | null;
  schedule: {
    frequency: number;
    interval: number;
    start: string;
    end: string | null;
    dayOfMonth: number | null;
    dayOfWeek: number | null;
  };
  isActive: boolean;
  nextOccurrence: string | null;
  materializedOccurrences: readonly string[];
  createdAt: string;
}
export interface ApiProjectedOccurrence {
  recurrence: ApiLinkRef;
  occurrence: string;
  amount: ApiMoney;
  kind: number;
}
export interface ApiMaterialization {
  occurrence: string;
  operation: string | null;
  movements: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class FinanceApiClient {
  private readonly transport = inject(API_TRANSPORT);
  session() {
    return this.get<ApiSession>(API_ROUTES.session);
  }
  csrf() {
    return this.get<{ token: string }>(API_ROUTES.csrf);
  }
  logout() {
    return this.transport.request<void>({ method: 'POST', path: API_ROUTES.logout });
  }
  createAccount(request: {
    name: string;
    kind: number;
    currency: string;
    institution?: string | null;
    lastFour?: string | null;
    isDefault?: boolean;
  }) {
    return this.transport.request<ApiAccount, typeof request>({
      method: 'POST',
      path: API_ROUTES.accounts,
      body: request,
    });
  }
  createAccountWithOpening(request: {
    account: {
      name: string;
      kind: number;
      currency: string;
      institution?: string | null;
      lastFour?: string | null;
      isDefault?: boolean;
    };
    openingBalance: ApiMoney;
    date: string;
    rate?: string | null;
    rateAsOf?: string | null;
    idempotencyKey?: string | null;
  }) {
    return this.transport.request<ApiAccountOpening>({
      method: 'POST',
      path: API_ROUTES.accountsWithOpening,
      body: request,
    });
  }
  accounts() {
    return this.get<readonly ApiAccount[]>(API_ROUTES.accounts);
  }
  cards() {
    return this.get<readonly ApiCard[]>(API_ROUTES.cards);
  }
  createCard(request: {
    name: string;
    currency: string;
    creditLimit: ApiMoney;
    cycle: { statementDay: number; paymentDueDay: number };
    terms: unknown;
    issuer?: string | null;
    lastFour?: string | null;
  }) {
    return this.transport.request<ApiCard>({ method: 'POST', path: API_ROUTES.cards, body: request });
  }
  cardStatus(id: string, asOf?: string) {
    return this.transport.request<unknown>({ method: 'GET', path: API_ROUTES.cardStatus(id), params: { asOf } });
  }
  categories() {
    return this.get<readonly ApiCategory[]>(API_ROUTES.categories);
  }
  createCategory(request: { name: string; type: number; color: string; icon: string; parent?: string | null }) {
    return this.transport.request<ApiCategory>({ method: 'POST', path: API_ROUTES.categories, body: request });
  }
  people() {
    return this.get<readonly ApiCounterparty[]>(API_ROUTES.people);
  }
  createPerson(request: {
    displayName: string;
    alias?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  }) {
    return this.transport.request<ApiCounterparty>({ method: 'POST', path: API_ROUTES.people, body: request });
  }
  debts() {
    return this.get<readonly ApiDebtPosition[]>(API_ROUTES.debts);
  }
  obligations() {
    return this.get<readonly unknown[]>(API_ROUTES.obligations);
  }
  investments(asOf?: string) {
    return this.transport.request<readonly ApiInvestment[]>({
      method: 'GET',
      path: API_ROUTES.investments,
      params: { asOf },
    });
  }
  createInvestment(request: {
    name: string;
    instrumentType: string;
    currency: string;
    risk: number;
    symbol?: string | null;
    institution?: string | null;
  }) {
    return this.transport.request<ApiInvestment>({ method: 'POST', path: API_ROUTES.investments, body: request });
  }
  dashboard(from?: string, to?: string) {
    return this.transport.request<ApiDashboard>({ method: 'GET', path: API_ROUTES.dashboard, params: { from, to } });
  }
  movements(query: MovementQuery) {
    const range = query.period ? monthRange(query.period) : undefined;
    return this.transport.request<ApiPage<ApiMovement>, unknown>({
      method: 'POST',
      path: API_ROUTES.movementSearch,
      body: {
        filter: {
          text: query.search || undefined,
          accounts: query.accountId ? [query.accountId] : undefined,
          range,
        },
        page: { page: query.page, size: query.pageSize },
        sortBy: 0,
        direction: 1,
      },
    });
  }
  movement(id: string) {
    return this.get<ApiMovement>(API_ROUTES.movement(id));
  }
  createMovement(request: unknown) {
    return this.transport.request<ApiMovement>({ method: 'POST', path: API_ROUTES.movements, body: request });
  }
  reclassifyMovement(id: string, request: { category: string | null; description: string | null }) {
    return this.transport.request<ApiMovement>({
      method: 'PUT',
      path: API_ROUTES.movementClassification(id),
      body: request,
    });
  }
  reverseMovement(id: string, request: { date: string; reason?: string | null }) {
    return this.transport.request<ApiMovement>({
      method: 'POST',
      path: API_ROUTES.movementReversal(id),
      body: request,
    });
  }
  updateAccount(
    id: string,
    request: {
      name: string;
      institution?: string | null;
      lastFour?: string | null;
      isDefault: boolean;
      isActive: boolean;
    },
  ) {
    return this.transport.request<ApiAccount>({ method: 'PUT', path: API_ROUTES.account(id), body: request });
  }
  createTransfer(request: unknown) {
    return this.transport.request<ApiOperation>({ method: 'POST', path: API_ROUTES.transfers, body: request });
  }
  createCardPayment(request: unknown) {
    return this.transport.request<ApiOperation>({ method: 'POST', path: API_ROUTES.cardPayments, body: request });
  }
  preferences() {
    return this.get<ApiPreference>(API_ROUTES.preferences);
  }
  updatePreferences(request: Omit<ApiPreference, 'userId' | 'updatedAt'>) {
    return this.transport.request<ApiPreference>({ method: 'PUT', path: API_ROUTES.preferences, body: request });
  }
  featureFlags() {
    return this.get<readonly ApiFeatureFlag[]>(API_ROUTES.featureFlags);
  }
  updateFeatureFlag(key: string, request: { isEnabled: boolean; audienceJson?: string | null }) {
    return this.transport.request<ApiFeatureFlag>({
      method: 'PUT',
      path: API_ROUTES.adminFeatureFlag(key),
      body: request,
    });
  }
  notifications(unreadOnly = false) {
    return this.transport.request<readonly ApiNotification[]>({
      method: 'GET',
      path: API_ROUTES.notifications,
      params: { unreadOnly },
    });
  }
  markNotificationRead(id: string, isRead = true) {
    return this.transport.request<ApiNotification>({
      method: 'PUT',
      path: API_ROUTES.notificationRead(id),
      body: { isRead },
    });
  }
  audit(page = 1, size = 50) {
    return this.transport.request<ApiPage<ApiAuditEvent>>({
      method: 'GET',
      path: API_ROUTES.audit,
      params: { page, size },
    });
  }
  adminUsers(page = 1, size = 25, search = '') {
    return this.transport.request<ApiPage<ApiAdminUser>>({
      method: 'GET',
      path: API_ROUTES.adminUsers,
      params: { page, size, search },
    });
  }
  setAdminUserActive(id: string, isActive: boolean) {
    return this.transport.request<void>({ method: 'PUT', path: API_ROUTES.adminUserActive(id), body: { isActive } });
  }
  setAdminUserCapability(id: string, organizationId: string, capability: string, isAllowed: boolean | null) {
    return this.transport.request<void>({
      method: 'PUT',
      path: API_ROUTES.adminUserCapability(id),
      body: { organizationId, capability, isAllowed },
    });
  }
  adminRoles() {
    return this.get<readonly ApiAdminRole[]>(API_ROUTES.adminRoles);
  }
  superAdminCapabilities() {
    return this.get<readonly ApiCapabilityDescriptor[]>(API_ROUTES.superAdminCapabilities);
  }
  assignAdminUserRoles(id: string, organizationId: string, roleIds: readonly string[]) {
    return this.transport.request<void>({
      method: 'PUT',
      path: API_ROUTES.adminUserRoles(id),
      body: { organizationId, roleIds },
    });
  }
  adminFeatureFlags() {
    return this.get<readonly ApiAdminFeatureFlag[]>(API_ROUTES.superAdminFeatureFlags);
  }
  updateAdminFeatureFlag(
    key: string,
    request: { organizationId?: string | null; userId?: string | null; isEnabled: boolean },
  ) {
    return this.transport.request<ApiFeatureFlag>({
      method: 'PUT',
      path: API_ROUTES.superAdminFeatureFlag(key),
      body: request,
    });
  }
  superAdminAudit(page = 1, size = 50) {
    return this.transport.request<ApiPage<ApiAuditEvent>>({
      method: 'GET',
      path: API_ROUTES.superAdminAudit,
      params: { page, size },
    });
  }
  saveAdminRole(
    id: string | null,
    request: { organizationId?: string; name: string; description: string; capabilities: readonly string[] },
  ) {
    return this.transport.request<ApiAdminRole>({
      method: id ? 'PUT' : 'POST',
      path: id ? API_ROUTES.adminRole(id) : API_ROUTES.adminRoles,
      body: request,
    });
  }
  adminErrors(page = 1, size = 25, status = '') {
    return this.transport.request<ApiPage<ApiClientError>>({
      method: 'GET',
      path: API_ROUTES.adminErrors,
      params: { page, size, status },
    });
  }
  updateAdminError(id: string, status: ApiClientError['status'], resolution?: string) {
    return this.transport.request<ApiClientError>({
      method: 'PUT',
      path: API_ROUTES.adminError(id),
      body: { status, resolution },
    });
  }
  recurrences() {
    return this.get<readonly ApiRecurrence[]>(API_ROUTES.recurrences);
  }
  createRecurrence(request: unknown) {
    return this.transport.request<ApiRecurrence>({ method: 'POST', path: API_ROUTES.recurrences, body: request });
  }
  projectedCalendar(from: string, to: string) {
    return this.transport.request<readonly ApiProjectedOccurrence[]>({
      method: 'GET',
      path: API_ROUTES.projectedCalendar,
      params: { from, to },
    });
  }
  materializeRecurrence(
    id: string,
    request: { occurrence: string; amount?: ApiMoney | null; idempotencyKey?: string | null },
  ) {
    return this.transport.request<ApiMaterialization>({
      method: 'POST',
      path: API_ROUTES.recurrenceMaterializations(id),
      body: request,
    });
  }
  sharedPurchases() {
    return this.get<readonly unknown[]>(API_ROUTES.sharedPurchases);
  }
  createSharedPurchase(request: {
    purchaseMovement: string;
    shares: readonly {
      counterparty: string;
      basis: number;
      percent?: { rate: string } | null;
      fixedAmount?: ApiMoney | null;
    }[];
    description?: string | null;
  }) {
    return this.transport.request<unknown>({ method: 'POST', path: API_ROUTES.sharedPurchases, body: request });
  }
  settlements() {
    return this.get<readonly unknown[]>(API_ROUTES.settlements);
  }
  issueSettlement(request: {
    counterparty: string;
    period: { start: string; end: string };
    cutOff: string;
    currency: string;
  }) {
    return this.transport.request<unknown>({ method: 'POST', path: API_ROUTES.settlements, body: request });
  }
  private get<T>(path: string): Observable<T> {
    return this.transport.request<T>({ method: 'GET', path });
  }
}

function monthRange(period: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error('El periodo debe usar el formato AAAA-MM.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('El mes solicitado no es válido.');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(lastDay).padStart(2, '0')}` };
}

export interface MovementRepository {
  list(query: MovementQuery): Observable<ApiPage<ApiMovementSummary>>;
}

export const MOVEMENT_REPOSITORY = new InjectionToken<MovementRepository>('MOVEMENT_REPOSITORY');

/** Stable v1 paths published by the backend; transport remains opt-in. */
export const API_ROUTES = {
  csrf: '/api/v1/auth/csrf',
  logout: '/api/v1/auth/logout',
  session: '/api/v1/session',
  accounts: '/api/v1/accounts',
  accountsWithOpening: '/api/v1/accounts/with-opening',
  cards: '/api/v1/cards',
  categories: '/api/v1/categories',
  people: '/api/v1/people',
  debts: '/api/v1/people/debt-positions',
  obligations: '/api/v1/obligations',
  investments: '/api/v1/investments',
  movementKinds: '/api/v1/movement-kinds',
  movementSearch: '/api/v1/movements/search',
  movements: '/api/v1/movements',
  transfers: '/api/v1/operations/transfers',
  cardPayments: '/api/v1/operations/card-payments',
  preferences: '/api/v1/preferences',
  featureFlags: '/api/v1/feature-flags',
  notifications: '/api/v1/notifications',
  audit: '/api/v1/admin/audit',
  adminUsers: '/api/v1/superadmin/users',
  adminRoles: '/api/v1/superadmin/roles',
  adminErrors: '/api/v1/superadmin/errors',
  superAdminCapabilities: '/api/v1/superadmin/capabilities',
  superAdminFeatureFlags: '/api/v1/superadmin/feature-flags',
  superAdminAudit: '/api/v1/superadmin/audit',
  recurrences: '/api/v1/recurrences',
  projectedCalendar: '/api/v1/calendar/projected',
  sharedPurchases: '/api/v1/shared-purchases',
  settlements: '/api/v1/settlements',
  cardStatus: (id: string) => `/api/v1/cards/${encodeURIComponent(id)}/status`,
  notificationRead: (id: string) => `/api/v1/notifications/${encodeURIComponent(id)}/read`,
  recurrenceMaterializations: (id: string) => `/api/v1/recurrences/${encodeURIComponent(id)}/materializations`,
  adminFeatureFlag: (key: string) => `/api/v1/admin/feature-flags/${encodeURIComponent(key)}`,
  adminUserActive: (id: string) => `/api/v1/superadmin/users/${encodeURIComponent(id)}/active`,
  adminUserCapability: (id: string) => `/api/v1/superadmin/users/${encodeURIComponent(id)}/capability-override`,
  adminUserRoles: (id: string) => `/api/v1/superadmin/users/${encodeURIComponent(id)}/roles`,
  adminRole: (id: string) => `/api/v1/superadmin/roles/${encodeURIComponent(id)}`,
  adminError: (id: string) => `/api/v1/superadmin/errors/${encodeURIComponent(id)}`,
  superAdminFeatureFlag: (key: string) => `/api/v1/superadmin/feature-flags/${encodeURIComponent(key)}`,
  movement: (id: string) => `/api/v1/movements/${encodeURIComponent(id)}`,
  movementClassification: (id: string) => `/api/v1/movements/${encodeURIComponent(id)}/classification`,
  movementReversal: (id: string) => `/api/v1/movements/${encodeURIComponent(id)}/reversal`,
  account: (id: string) => `/api/v1/accounts/${encodeURIComponent(id)}`,
  dashboard: '/api/v1/dashboard',
  openApi: '/openapi/v1.json',
} as const;
