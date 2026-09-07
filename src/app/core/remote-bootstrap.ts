import { Injectable, inject } from '@angular/core';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { Account, DemoData, Movement } from './demo-data';
import {
  ApiAccount,
  ApiCapability,
  ApiCard,
  ApiDebtPosition,
  ApiInvestment,
  ApiMovement,
  ApiNotification,
  ApiRequestError,
  ApiSession,
  FinanceApiClient,
} from './api-client';
import { DemoStore } from './store';

@Injectable({ providedIn: 'root' })
export class RemoteBootstrap {
  private readonly api = inject(FinanceApiClient);
  private readonly store = inject(DemoStore);

  async initialize(): Promise<void> {
    if (this.store.runtime.mode !== 'api') return;
    this.store.remoteState.set('loading');
    try {
      const session = await firstValueFrom(this.api.session());
      const capabilities = new Set(session.capabilities);
      const canViewLedger = capabilities.has(ApiCapability.viewLedger);
      const canViewAccounts = canViewLedger || capabilities.has(ApiCapability.viewAccounts);
      const result = await firstValueFrom(
        forkJoin({
          accounts: canViewAccounts ? this.api.accounts() : of([]),
          cards: canViewAccounts ? this.api.cards() : of([]),
          categories: canViewAccounts ? this.api.categories() : of([]),
          people: capabilities.has(ApiCapability.managePeople) ? this.api.people() : of([]),
          debts: canViewLedger ? this.api.debts() : of([]),
          investments: capabilities.has(ApiCapability.manageInvestments) ? this.api.investments() : of([]),
          movements: capabilities.has(ApiCapability.viewMovements)
            ? this.api.movements({ page: 1, pageSize: 25 })
            : of({ items: [], page: 1, size: 25, total: 0, totalPages: 0, hasNext: false }),
          preferences: canViewLedger ? this.api.preferences() : of(null),
          featureFlags: canViewLedger ? this.api.featureFlags() : of([]),
          notifications: canViewLedger ? this.api.notifications() : of([]),
        }),
      );
      this.store.data.set(
        this.toViewData(
          result.accounts,
          result.cards,
          result.movements.items,
          result.people,
          result.debts,
          result.investments,
          result.notifications,
        ),
      );
      this.store.remoteMovementPage.set(result.movements.page);
      this.store.remoteMovementSize.set(result.movements.size);
      this.store.remoteMovementTotal.set(result.movements.total);
      this.store.user.set(this.toViewUser(session));
      if (result.preferences) {
        let custom: { accent?: string; radius?: number } = {};
        try {
          custom = result.preferences.customThemeJson ? JSON.parse(result.preferences.customThemeJson) : {};
        } catch {
          custom = {};
        }
        this.store.preferences.update((value) => ({
          ...value,
          locale: result.preferences!.language,
          theme: result.preferences!.theme as typeof value.theme,
          font: result.preferences!.font,
          density: result.preferences!.density as typeof value.density,
          accent: custom.accent ?? value.accent,
          radius: custom.radius ?? value.radius,
        }));
      }
      this.store.featureFlags.set(Object.fromEntries(result.featureFlags.map((flag) => [flag.key, flag.isEnabled])));
      this.store.categories.set(result.categories);
      this.store.remoteState.set('ready');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        this.store.remoteError.set('');
        this.store.user.set(null);
        this.store.remoteState.set('anonymous');
        return;
      }
      this.store.remoteError.set(error instanceof Error ? error.message : 'No fue posible cargar la API.');
      this.store.remoteState.set('error');
      this.store.user.set(null);
    }
  }

  private toViewUser(session: ApiSession): (typeof this.store.users)[number] {
    return {
      id: session.user.id,
      name: session.user.displayName,
      email: session.user.email,
      capabilities: [...(session.permissions ?? [])],
    };
  }

  private toViewData(
    accounts: readonly ApiAccount[],
    cards: readonly ApiCard[],
    movements: readonly ApiMovement[],
    people: readonly { id: string; displayName: string }[],
    debts: readonly ApiDebtPosition[],
    investments: readonly ApiInvestment[],
    notifications: readonly ApiNotification[],
  ): DemoData {
    const viewAccounts: Account[] = [
      ...accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.kind === 1 ? ('cash' as const) : ('savings' as const),
        currency: account.currency,
        openingBalance: 0,
        lastFour: account.lastFour ?? '0000',
        color: '#087f68',
      })),
      ...cards.map((card) => ({
        id: card.id,
        name: card.name,
        type: 'credit' as const,
        currency: card.currency,
        openingBalance: 0,
        limit: Number(card.creditLimit.amount),
        lastFour: card.lastFour ?? '0000',
        color: '#4338ca',
        cutDay: card.cycle.statementDay,
        dueDay: card.cycle.paymentDueDay,
      })),
    ];
    const debtByPerson = new Map(debts.map((debt) => [debt.counterparty.id, debt]));
    return {
      accounts: viewAccounts,
      movements: movements.map((movement) => this.toMovement(movement)),
      people: people.map((person) => {
        const position = debtByPerson.get(person.id);
        return {
          id: person.id,
          name: person.displayName,
          owed: Number(position?.receivable.amount ?? 0),
          owing: Number(position?.ownDebt.amount ?? 0),
          relationship: 'Otro' as const,
        };
      }),
      investments: investments.map((investment) => ({
        id: investment.id,
        name: investment.name,
        type: investment.instrumentType,
        cost: Number(investment.costBasis.amount),
        value: Number(investment.marketValue?.amount ?? investment.costBasis.amount),
        institution: 'Sin especificar',
        currency: investment.currency,
        units: 0,
        risk: 'Medio' as const,
        liquidity: 'Programada' as const,
      })),
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        detail: this.notificationDetail(notification),
        read: notification.readAt !== null,
      })),
      auditEvents: [],
      featureFlags: {},
    };
  }

  private notificationDetail(notification: ApiNotification): string {
    try {
      const payload = JSON.parse(notification.payloadJson) as Record<string, unknown>;
      return String(payload['detail'] ?? payload['description'] ?? notification.kind);
    } catch {
      return notification.kind;
    }
  }

  private toMovement(source: ApiMovement): Movement {
    const accountId = source.links['account'] ?? source.links['card'] ?? '';
    const sign = source.flow === 2 || (source.flow === 0 && source.effect === 2) ? -1 : 1;
    const kind: Movement['kind'] =
      source.kind === 1
        ? 'income'
        : source.kind === 10 || source.kind === 11
          ? 'transfer'
          : source.kind === 21
            ? 'payment'
            : 'expense';
    return {
      id: source.id,
      date: source.date,
      description: source.description ?? 'Sin descripción',
      accountId,
      category: source.linkNames['category']?.name ?? 'Sin categoría',
      kind,
      amount: Number(source.amount.base.amount) * sign,
      status: 'confirmed',
      person: source.linkNames['counterparty']?.name,
      ownership: source.links['counterparty'] ? 'loaned' : 'own',
      recurring: Boolean(source.links['recurrence']),
      originalCurrency: source.amount.original.currency === 'USD' ? 'USD' : 'COP',
      originalAmount: Number(source.amount.original.amount),
      exchangeRate: Number(source.amount.rate),
    };
  }
}
