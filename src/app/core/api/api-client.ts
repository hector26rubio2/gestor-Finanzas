import { inject, Injectable } from '@angular/core';
import { AccountsApi } from './accounts.api';
import { AdministrationApi } from './administration.api';
import { CardsApi } from './cards.api';
import { CategoriesApi } from './categories.api';
import { InvestmentsApi } from './investments.api';
import { LedgerApi } from './ledger.api';
import { NotificationsApi } from './notifications.api';
import { ObligationsApi } from './obligations.api';
import { PeopleApi } from './people.api';
import { PreferencesApi } from './preferences.api';
import { PurchasesApi } from './purchases.api';
import { RecurrencesApi } from './recurrences.api';
import { ReportingApi } from './reporting.api';
import { SessionApi } from './session.api';
import { SettlementsApi } from './settlements.api';
import { ApiClientError, BugReportPayload } from './administration.api';
import { ApiPreference } from './preferences.api';
import { MovementQuery } from './shared-api-types';

// Transporte HTTP: puertos y adaptador CSRF, movidos a core/http/.
export { API_TRANSPORT, ApiRequestError, HttpApiTransport } from '../http/api-http-client';
export type { ApiRequest, ApiTransport, ApiProblem } from '../http/api-http-client';

// Tabla de rutas y tipos compartidos, movidos a core/api/.
export { API_ROUTES } from './api-routes';
export { MOVEMENT_REPOSITORY } from './shared-api-types';
export type {
  ApiPage,
  MovementQuery,
  ApiMoney,
  ApiMovementSummary,
  ApiLinkRef,
  ApiConvertedMoney,
  MovementRepository,
} from './shared-api-types';

// DTOs y clientes por recurso: uno por feature, igual que en el backend.
export { SessionApi } from './session.api';
export type { ApiUser, ApiOrganization, ApiSession } from './session.api';
export { AccountsApi, ApiAccountKind } from './accounts.api';
export type { ApiAccount, ApiAccountOpening } from './accounts.api';
export { LedgerApi } from './ledger.api';
export type { ApiMovement, ApiOperation } from './ledger.api';
export { CardsApi } from './cards.api';
export type { ApiCard } from './cards.api';
export { CategoriesApi } from './categories.api';
export type { ApiCategory } from './categories.api';
export { PeopleApi } from './people.api';
export type { ApiCounterparty, ApiDebtPosition } from './people.api';
export { ObligationsApi } from './obligations.api';
export { InvestmentsApi } from './investments.api';
export type { ApiInvestment } from './investments.api';
export { ReportingApi } from './reporting.api';
export type { ApiPeriodPoint, ApiCategoryTotal, ApiDashboard } from './reporting.api';
export { PreferencesApi } from './preferences.api';
export type { ApiPreference, ApiFeatureFlag } from './preferences.api';
export { NotificationsApi } from './notifications.api';
export type { ApiNotification } from './notifications.api';
export { AdministrationApi, ApiPermissionAction, ApiPermissionLevel } from './administration.api';
export type {
  ApiAuditEvent,
  ApiAdminUser,
  ApiAdminRole,
  ApiAdminOrganization,
  ApiPermissionDescriptor,
  ApiAdminOverride,
  ApiOrganizationMember,
  ApiCapabilityDescriptor,
  ApiAdminFeatureFlag,
  ApiClientError,
  BugReportPayload,
} from './administration.api';
export { RecurrencesApi } from './recurrences.api';
export type { ApiRecurrence, ApiProjectedOccurrence, ApiMaterialization } from './recurrences.api';
export { PurchasesApi } from './purchases.api';
export { SettlementsApi } from './settlements.api';

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
  devLogin(who: 'admin' | 'member' = 'admin') {
    return this.sessionApi.devLogin(who);
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
  adminRoles(page = 1, size = 25, organizationId?: string) {
    return this.administrationApi.adminRoles(page, size, organizationId);
  }
  adminOrganizations(page = 1, size = 25) {
    return this.administrationApi.adminOrganizations(page, size);
  }
  createAdminOrganization(...args: Parameters<AdministrationApi['createAdminOrganization']>) {
    return this.administrationApi.createAdminOrganization(...args);
  }
  moveAdminUserOrganization(...args: Parameters<AdministrationApi['moveAdminUserOrganization']>) {
    return this.administrationApi.moveAdminUserOrganization(...args);
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
  reportBug(payload: BugReportPayload) {
    return this.administrationApi.reportBug(payload);
  }
  screenshotUrl(id: string) {
    return this.administrationApi.screenshotUrl(id);
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
