import { inject, Injectable } from '@angular/core';
import { AccountsApi } from './api/accounts.api';
import { AdministrationApi } from './api/administration.api';
import { CardsApi } from './api/cards.api';
import { CategoriesApi } from './api/categories.api';
import { InvestmentsApi } from './api/investments.api';
import { LedgerApi } from './api/ledger.api';
import { NotificationsApi } from './api/notifications.api';
import { ObligationsApi } from './api/obligations.api';
import { PeopleApi } from './api/people.api';
import { PreferencesApi } from './api/preferences.api';
import { PurchasesApi } from './api/purchases.api';
import { RecurrencesApi } from './api/recurrences.api';
import { ReportingApi } from './api/reporting.api';
import { SessionApi } from './api/session.api';
import { SettlementsApi } from './api/settlements.api';
import { ApiClientError } from './api/administration.api';
import { ApiPreference } from './api/preferences.api';
import { MovementQuery } from './api/shared-api-types';

// Transporte HTTP: puertos y adaptador CSRF, movidos a core/http/.
export { API_TRANSPORT, ApiRequestError, HttpApiTransport } from './http/api-http-client';
export type { ApiRequest, ApiTransport, ApiProblem } from './http/api-http-client';

// Tabla de rutas y tipos compartidos, movidos a core/api/.
export { API_ROUTES } from './api/api-routes';
export { MOVEMENT_REPOSITORY } from './api/shared-api-types';
export type {
  ApiPage,
  MovementQuery,
  ApiMoney,
  ApiMovementSummary,
  ApiLinkRef,
  ApiConvertedMoney,
  MovementRepository,
} from './api/shared-api-types';

// DTOs y clientes por recurso: uno por feature, igual que en el backend.
export { SessionApi } from './api/session.api';
export type { ApiUser, ApiOrganization, ApiSession } from './api/session.api';
export { AccountsApi, ApiAccountKind } from './api/accounts.api';
export type { ApiAccount, ApiAccountOpening } from './api/accounts.api';
export { LedgerApi } from './api/ledger.api';
export type { ApiMovement, ApiOperation } from './api/ledger.api';
export { CardsApi } from './api/cards.api';
export type { ApiCard } from './api/cards.api';
export { CategoriesApi } from './api/categories.api';
export type { ApiCategory } from './api/categories.api';
export { PeopleApi } from './api/people.api';
export type { ApiCounterparty, ApiDebtPosition } from './api/people.api';
export { ObligationsApi } from './api/obligations.api';
export { InvestmentsApi } from './api/investments.api';
export type { ApiInvestment } from './api/investments.api';
export { ReportingApi } from './api/reporting.api';
export type { ApiPeriodPoint, ApiCategoryTotal, ApiDashboard } from './api/reporting.api';
export { PreferencesApi } from './api/preferences.api';
export type { ApiPreference, ApiFeatureFlag } from './api/preferences.api';
export { NotificationsApi } from './api/notifications.api';
export type { ApiNotification } from './api/notifications.api';
export { AdministrationApi, ApiPermissionAction, ApiPermissionLevel } from './api/administration.api';
export type {
  ApiAuditEvent,
  ApiAdminUser,
  ApiAdminRole,
  ApiPermissionDescriptor,
  ApiAdminOverride,
  ApiOrganizationMember,
  ApiCapabilityDescriptor,
  ApiAdminFeatureFlag,
  ApiClientError,
} from './api/administration.api';
export { RecurrencesApi } from './api/recurrences.api';
export type { ApiRecurrence, ApiProjectedOccurrence, ApiMaterialization } from './api/recurrences.api';
export { PurchasesApi } from './api/purchases.api';
export { SettlementsApi } from './api/settlements.api';

/**
 * Fachada de compatibilidad: conserva los ~50 métodos que las páginas ya usan
 * mientras esas páginas siguen sin dividirse en `features/`. Cada método
 * delega en el cliente de su feature — la lógica real vive allí, no aquí.
 */
@Injectable({ providedIn: 'root' })
export class FinanceApiClient {
  private readonly sessionApi = inject(SessionApi);
  private readonly accountsApi = inject(AccountsApi);
  private readonly ledgerApi = inject(LedgerApi);
  private readonly cardsApi = inject(CardsApi);
  private readonly categoriesApi = inject(CategoriesApi);
  private readonly peopleApi = inject(PeopleApi);
  private readonly obligationsApi = inject(ObligationsApi);
  private readonly investmentsApi = inject(InvestmentsApi);
  private readonly reportingApi = inject(ReportingApi);
  private readonly preferencesApi = inject(PreferencesApi);
  private readonly notificationsApi = inject(NotificationsApi);
  private readonly administrationApi = inject(AdministrationApi);
  private readonly recurrencesApi = inject(RecurrencesApi);
  private readonly purchasesApi = inject(PurchasesApi);
  private readonly settlementsApi = inject(SettlementsApi);

  session() {
    return this.sessionApi.session();
  }
  movementKinds() {
    return this.ledgerApi.movementKinds();
  }
  csrf() {
    return this.sessionApi.csrf();
  }
  logout() {
    return this.sessionApi.logout();
  }
  createAccount(...args: Parameters<AccountsApi['createAccount']>) {
    return this.accountsApi.createAccount(...args);
  }
  createAccountWithOpening(...args: Parameters<AccountsApi['createAccountWithOpening']>) {
    return this.accountsApi.createAccountWithOpening(...args);
  }
  accounts() {
    return this.accountsApi.accounts();
  }
  cards() {
    return this.cardsApi.cards();
  }
  createCard(...args: Parameters<CardsApi['createCard']>) {
    return this.cardsApi.createCard(...args);
  }
  cardStatus(id: string, asOf?: string) {
    return this.cardsApi.cardStatus(id, asOf);
  }
  categories() {
    return this.categoriesApi.categories();
  }
  createCategory(...args: Parameters<CategoriesApi['createCategory']>) {
    return this.categoriesApi.createCategory(...args);
  }
  people() {
    return this.peopleApi.people();
  }
  createPerson(...args: Parameters<PeopleApi['createPerson']>) {
    return this.peopleApi.createPerson(...args);
  }
  debts() {
    return this.peopleApi.debts();
  }
  obligations() {
    return this.obligationsApi.obligations();
  }
  investments(asOf?: string) {
    return this.investmentsApi.investments(asOf);
  }
  createInvestment(...args: Parameters<InvestmentsApi['createInvestment']>) {
    return this.investmentsApi.createInvestment(...args);
  }
  dashboard(from?: string, to?: string) {
    return this.reportingApi.dashboard(from, to);
  }
  movements(query: MovementQuery) {
    return this.ledgerApi.movements(query);
  }
  movement(id: string) {
    return this.ledgerApi.movement(id);
  }
  createMovement(request: unknown) {
    return this.ledgerApi.createMovement(request);
  }
  reclassifyMovement(...args: Parameters<LedgerApi['reclassifyMovement']>) {
    return this.ledgerApi.reclassifyMovement(...args);
  }
  reverseMovement(...args: Parameters<LedgerApi['reverseMovement']>) {
    return this.ledgerApi.reverseMovement(...args);
  }
  updateAccount(...args: Parameters<AccountsApi['updateAccount']>) {
    return this.accountsApi.updateAccount(...args);
  }
  createTransfer(request: unknown) {
    return this.ledgerApi.createTransfer(request);
  }
  createCardPayment(request: unknown) {
    return this.ledgerApi.createCardPayment(request);
  }
  preferences() {
    return this.preferencesApi.preferences();
  }
  updatePreferences(request: Omit<ApiPreference, 'userId' | 'updatedAt'>) {
    return this.preferencesApi.updatePreferences(request);
  }
  featureFlags() {
    return this.preferencesApi.featureFlags();
  }
  updateFeatureFlag(...args: Parameters<AdministrationApi['updateFeatureFlag']>) {
    return this.administrationApi.updateFeatureFlag(...args);
  }
  notifications(unreadOnly = false) {
    return this.notificationsApi.notifications(unreadOnly);
  }
  markNotificationRead(id: string, isRead = true) {
    return this.notificationsApi.markNotificationRead(id, isRead);
  }
  audit(page = 1, size = 50) {
    return this.administrationApi.audit(page, size);
  }
  adminUsers(page = 1, size = 25, search = '') {
    return this.administrationApi.adminUsers(page, size, search);
  }
  setAdminUserActive(id: string, isActive: boolean) {
    return this.administrationApi.setAdminUserActive(id, isActive);
  }
  setAdminUserCapability(...args: Parameters<AdministrationApi['setAdminUserCapability']>) {
    return this.administrationApi.setAdminUserCapability(...args);
  }
  organizationMembers() {
    return this.administrationApi.organizationMembers();
  }
  inviteOrganizationMember(...args: Parameters<AdministrationApi['inviteOrganizationMember']>) {
    return this.administrationApi.inviteOrganizationMember(...args);
  }
  adminRoles(page = 1, size = 25) {
    return this.administrationApi.adminRoles(page, size);
  }
  deleteAdminRole(id: string) {
    return this.administrationApi.deleteAdminRole(id);
  }
  setAdminRoleActive(id: string, isActive: boolean) {
    return this.administrationApi.setAdminRoleActive(id, isActive);
  }
  superAdminPermissions() {
    return this.administrationApi.superAdminPermissions();
  }
  superAdminCapabilities() {
    return this.administrationApi.superAdminCapabilities();
  }
  assignAdminUserRoles(...args: Parameters<AdministrationApi['assignAdminUserRoles']>) {
    return this.administrationApi.assignAdminUserRoles(...args);
  }
  adminFeatureFlags() {
    return this.administrationApi.adminFeatureFlags();
  }
  updateAdminFeatureFlag(...args: Parameters<AdministrationApi['updateAdminFeatureFlag']>) {
    return this.administrationApi.updateAdminFeatureFlag(...args);
  }
  superAdminAudit(page = 1, size = 50) {
    return this.administrationApi.superAdminAudit(page, size);
  }
  saveAdminRole(...args: Parameters<AdministrationApi['saveAdminRole']>) {
    return this.administrationApi.saveAdminRole(...args);
  }
  adminErrors(page = 1, size = 25, status = '') {
    return this.administrationApi.adminErrors(page, size, status);
  }
  updateAdminError(id: string, status: ApiClientError['status'], resolution?: string) {
    return this.administrationApi.updateAdminError(id, status, resolution);
  }
  recurrences() {
    return this.recurrencesApi.recurrences();
  }
  createRecurrence(request: unknown) {
    return this.recurrencesApi.createRecurrence(request);
  }
  projectedCalendar(from: string, to: string) {
    return this.recurrencesApi.projectedCalendar(from, to);
  }
  materializeRecurrence(...args: Parameters<RecurrencesApi['materializeRecurrence']>) {
    return this.recurrencesApi.materializeRecurrence(...args);
  }
  sharedPurchases() {
    return this.purchasesApi.sharedPurchases();
  }
  createSharedPurchase(request: Parameters<PurchasesApi['createSharedPurchase']>[0]) {
    return this.purchasesApi.createSharedPurchase(request);
  }
  settlements() {
    return this.settlementsApi.settlements();
  }
  issueSettlement(request: Parameters<SettlementsApi['issueSettlement']>[0]) {
    return this.settlementsApi.issueSettlement(request);
  }
}
