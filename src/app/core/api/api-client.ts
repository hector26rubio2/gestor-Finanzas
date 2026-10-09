import { inject, Injectable } from '@angular/core';
import { AccountsApi } from './accounts.api';
import { AdministrationApi } from './administration.api';
import { BootstrapApi } from './bootstrap.api';
import { CardsApi } from './cards.api';
import { CategoriesApi } from './categories.api';
import { InvestmentsApi } from './investments.api';
import {
  CreateCardPaymentBody,
  CreateCashAdvanceBody,
  CreateMovementBody,
  CreateTransferBody,
  LedgerApi,
} from './ledger.api';
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

export { API_TRANSPORT, ApiRequestError, HttpApiTransport } from '@core/http/api-http-client';
export type { ApiRequest, ApiTransport, ApiProblem } from '@core/http/api-http-client';

export { API_ROUTES } from './api-routes';
export type { ApiPage, MovementQuery, ApiMoney, ApiLinkRef, ApiConvertedMoney } from './shared-api-types';

export { SessionApi } from './session.api';
export { BootstrapApi } from './bootstrap.api';
export type { ApiBootstrap, ApiBootstrapPart, ApiBootstrapOmission, ApiBootstrapBalances } from './bootstrap.api';
export type { ApiUser, ApiOrganization, ApiSession, ApiCurrency, ApiAuthMethods } from './session.api';
export { AccountsApi, ApiAccountKind, accountKindToViewType, viewTypeToAccountKind } from './accounts.api';
export type { ApiAccount, ApiAccountOpening, AccountViewType, AccountKindViewType } from './accounts.api';
export { LedgerApi } from './ledger.api';
export type {
  ApiMovement,
  ApiOperation,
  CreateMovementBody,
  CreateMovementLinks,
  CreateTransferBody,
  CreateCardPaymentBody,
  CreateCashAdvanceBody,
} from './ledger.api';
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

@Injectable({ providedIn: 'root' })
export class FinanceApiClient {
  private readonly sessionApi = inject(SessionApi);
  private readonly bootstrapApi = inject(BootstrapApi);
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

  bootstrap(asOf: string) {
    return this.bootstrapApi.bootstrap(asOf);
  }
  session() {
    return this.sessionApi.session();
  }
  currencies() {
    return this.sessionApi.currencies();
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
  authMethods() {
    return this.sessionApi.authMethods();
  }
  loginWithPassword(userName: string, password: string) {
    return this.sessionApi.loginWithPassword(userName, password);
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
  updateCard(...args: Parameters<CardsApi['updateCard']>) {
    return this.cardsApi.updateCard(...args);
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
  updateCategory(...args: Parameters<CategoriesApi['updateCategory']>) {
    return this.categoriesApi.updateCategory(...args);
  }
  people() {
    return this.peopleApi.people();
  }
  createPerson(...args: Parameters<PeopleApi['createPerson']>) {
    return this.peopleApi.createPerson(...args);
  }
  updatePerson(...args: Parameters<PeopleApi['updatePerson']>) {
    return this.peopleApi.updatePerson(...args);
  }
  debts() {
    return this.peopleApi.debts();
  }
  createLoan(...args: Parameters<ObligationsApi['createLoan']>) {
    return this.obligationsApi.createLoan(...args);
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
  updateInvestment(...args: Parameters<InvestmentsApi['updateInvestment']>) {
    return this.investmentsApi.updateInvestment(...args);
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
  createMovement(request: CreateMovementBody) {
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
  createTransfer(request: CreateTransferBody) {
    return this.ledgerApi.createTransfer(request);
  }
  createCardPayment(request: CreateCardPaymentBody) {
    return this.ledgerApi.createCardPayment(request);
  }
  createCashAdvance(request: CreateCashAdvanceBody) {
    return this.ledgerApi.createCashAdvance(request);
  }
  preferences() {
    return this.preferencesApi.preferences();
  }
  updatePreferences(request: Omit<ApiPreference, 'userId' | 'updatedAt' | 'dashboardLayoutJson'>) {
    return this.preferencesApi.updatePreferences(request);
  }
  saveDashboardLayout(layoutJson: string | null) {
    return this.preferencesApi.saveDashboardLayout(layoutJson);
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
  deleteAdminOrganization(id: string) {
    return this.administrationApi.deleteAdminOrganization(id);
  }
  consolidateAdminOrganizations() {
    return this.administrationApi.consolidateAdminOrganizations();
  }
  setAdminUserActive(id: string, isActive: boolean) {
    return this.administrationApi.setAdminUserActive(id, isActive);
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
  setPermissionDescription(code: string, description: string | null) {
    return this.administrationApi.setPermissionDescription(code, description);
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
  createErrorGithubIssue(id: string) {
    return this.administrationApi.createErrorGithubIssue(id);
  }
  screenshotUrl(id: string) {
    return this.administrationApi.screenshotUrl(id);
  }
  recurrences() {
    return this.recurrencesApi.recurrences();
  }
  deleteRecurrence(id: string) {
    return this.recurrencesApi.deleteRecurrence(id);
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
