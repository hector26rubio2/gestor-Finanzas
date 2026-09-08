import { Injectable, inject } from '@angular/core';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { Account, DemoData, Movement } from './demo-data';
import {
  ApiAccount,
  ApiAccountKind,
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
import { parseAmount, parseMoney, parseRate } from './money';
import { MovementKindCatalog, signOf } from './movement-kinds';
import { DemoStore } from './store';

@Injectable({ providedIn: 'root' })
export class RemoteBootstrap {
  private readonly api = inject(FinanceApiClient);
  private readonly store = inject(DemoStore);
  private sessionSignature: string | null = null;

  async start(): Promise<void> {
    this.store.restoreDemoSession();
    await this.initialize();
    if (this.store.runtime.mode !== 'api') return;
    window.setInterval(() => void this.pollSession(), 60_000);
    window.addEventListener('focus', () => void this.pollSession());
  }

  async initialize(): Promise<void> {
    if (this.store.runtime.mode !== 'api') return;
    this.store.remoteState.set('loading');
    try {
      const session = await firstValueFrom(this.api.session());
      this.sessionSignature = this.signature(session);
      const capabilities = new Set(session.capabilities);
      const canViewLedger = capabilities.has(ApiCapability.viewLedger);
      const canViewAccounts = canViewLedger || capabilities.has(ApiCapability.viewAccounts);
      const result = await firstValueFrom(
        forkJoin({
          movementKinds: canViewLedger ? this.api.movementKinds() : of([]),
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
          notifications: this.api.notifications(),
        }),
      );
      // El catálogo entra antes que los movimientos: la familia de cada clase se
      // deriva de la tabla publicada, no de números escritos a mano en el cliente.
      const catalog = new MovementKindCatalog(result.movementKinds);
      this.store.kindCatalog.set(catalog);
      this.store.data.set(
        this.toViewData(
          catalog,
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

  /** Revisa la sesión y recarga todo cuando un administrador cambia los permisos. */
  async pollSession(): Promise<void> {
    if (this.store.runtime.mode !== 'api' || this.store.remoteState() === 'loading') return;
    try {
      const session = await firstValueFrom(this.api.session());
      const signature = this.signature(session);
      if (this.sessionSignature !== null && signature !== this.sessionSignature) await this.initialize();
    } catch {
      /* los errores transitorios se ignoran; el próximo ciclo reintenta */
    }
  }

  private signature(session: ApiSession): string {
    return JSON.stringify([
      [...session.capabilities].sort(),
      [...(session.permissions ?? [])].sort(),
      session.isSuperAdmin === true,
    ]);
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
    catalog: MovementKindCatalog,
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
        type: account.kind === ApiAccountKind.cash ? ('cash' as const) : ('savings' as const),
        currency: account.currency,
        openingBalance: 0,
        lastFour: account.lastFour ?? undefined,
        institution: account.institution ?? undefined,
      })),
      ...cards.map((card) => ({
        id: card.id,
        name: card.name,
        type: 'credit' as const,
        currency: card.currency,
        openingBalance: 0,
        limit: parseMoney(card.creditLimit),
        lastFour: card.lastFour ?? undefined,
        cutDay: card.cycle.statementDay,
        dueDay: card.cycle.paymentDueDay,
      })),
    ];
    const debtByPerson = new Map(debts.map((debt) => [debt.counterparty.id, debt]));
    // Los campos que la API todavía no expone se dejan ausentes a propósito.
    // Rellenarlos con constantes plausibles —riesgo «Medio», liquidez
    // «Programada», cero unidades— los presentaba en pantalla como si fueran
    // datos medidos. Un dato que falta se comunica; no se sustituye.
    return {
      accounts: viewAccounts,
      movements: movements.map((movement) => this.toMovement(catalog, movement)),
      people: people.map((person) => {
        const position = debtByPerson.get(person.id);
        return {
          id: person.id,
          name: person.displayName,
          owed: parseMoney(position?.receivable),
          owing: parseMoney(position?.ownDebt),
        };
      }),
      investments: investments.map((investment) => ({
        id: investment.id,
        name: investment.name,
        type: investment.instrumentType,
        cost: parseMoney(investment.costBasis),
        value: parseMoney(investment.marketValue ?? investment.costBasis),
        currency: investment.currency,
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

  private toMovement(catalog: MovementKindCatalog, source: ApiMovement): Movement {
    const accountId = source.links['account'] ?? source.links['card'] ?? '';
    const sign = signOf(source.flow, source.effect);
    return {
      id: source.id,
      date: source.date,
      description: source.description ?? 'Sin descripción',
      accountId,
      category: source.linkNames['category']?.name ?? 'Sin categoría',
      kind: catalog.family(source.kind, source.effect, source.flow),
      amount: parseMoney(source.amount.base) * sign,
      status: 'confirmed',
      person: source.linkNames['counterparty']?.name,
      ownership: source.links['counterparty'] ? 'loaned' : 'own',
      recurring: Boolean(source.links['recurrence']),
      originalCurrency: source.amount.original.currency === 'USD' ? 'USD' : 'COP',
      originalAmount: parseAmount(source.amount.original.amount, source.amount.original.currency),
      exchangeRate: parseRate(source.amount.rate),
    };
  }
}
