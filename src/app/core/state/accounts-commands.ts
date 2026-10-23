import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ApiMovement } from '@core/api/ledger.api';
import { Account, type Movement } from './view-model';
import { FinanceApiClient, viewTypeToAccountKind } from '@core/api/api-client';
import { parseMoney } from '@core/utils/money';
import { I18nService } from '@core/i18n';
import { AppStore, type CondicionesDeTarjeta } from './store';
import { conPrioridad, conTasa, tarjetaAAccount, tasaAnual } from './catalog-mappers';

/** Comandos de alta/edición de cuentas y tarjetas. */
@Injectable({ providedIn: 'root' })
export class AccountsCommands {
  constructor(
    private readonly store: AppStore,
    private readonly client: FinanceApiClient,
    private readonly i18n: I18nService,
  ) {}

  async createAccount(
    name: string,
    type: Account['type'],
    opening: number,
    currency = 'COP',
    exchangeRate?: number,
    credit?: CondicionesDeTarjeta,
    lastFour?: string,
    issuerId?: string,
  ) {
    const digitos = lastFour?.trim() || undefined;
    if (digitos && !/^\d{4}$/.test(digitos)) throw new Error(this.i18n.t('form.account.error.lastFour'));
    const anual = credit?.monthlyRate === undefined ? undefined : tasaAnual(credit.monthlyRate);
    const tasaApi = String((anual ?? 0) / 100);
    if (opening < 0) throw new Error(this.i18n.t('form.account.error.openingNegative'));
    if (type === 'credit') {
      if (!credit || credit.limit <= 0) throw new Error(this.i18n.t('form.account.error.creditLimit'));
      const created = await firstValueFrom(
        this.client.createCard({
          name,
          currency,
          creditLimit: { amount: String(credit.limit), currency },
          cycle: { statementDay: credit.cutDay, paymentDueDay: credit.dueDay },
          terms: {
            purchaseApr: { rate: tasaApi },
            cashAdvanceApr: { rate: tasaApi },
            internationalPurchaseApr: { rate: tasaApi },
            deferredDefaultApr: { rate: tasaApi },
            minimumPaymentRate: { rate: '0' },
            minimumPaymentFloor: null,
            gracePeriodDays: 0,
            paymentPriority: credit.paymentPriority ?? null,
            foreignPaymentPriority: credit.foreignPaymentPriority ?? null,
            monthlyFee: credit.monthlyFee ? { amount: String(credit.monthlyFee), currency } : null,
            dualCurrency: credit.dualCurrency === true,
          },
          lastFour: digitos ?? null,
          issuerEntity: credit.issuerId || null,
        }),
      );
      this.store.data.update((data) => ({
        ...data,
        accounts: [...data.accounts, tarjetaAAccount(created, credit)],
      }));
      this.store.form.set(null);
      return;
    }
    const accountRequest = {
      name,
      kind: viewTypeToAccountKind(type),
      currency,
      lastFour: digitos ?? null,
      issuerEntity: issuerId || null,
    };
    const openingResult =
      opening === 0
        ? null
        : await firstValueFrom(
            this.client.createAccountWithOpening({
              account: accountRequest,
              openingBalance: { amount: String(Math.abs(opening)), currency },
              date: new Date().toISOString().slice(0, 10),
              rate: currency === 'USD' ? String(exchangeRate) : null,
              rateAsOf: currency === 'USD' ? new Date().toISOString().slice(0, 10) : null,
              idempotencyKey: crypto.randomUUID(),
            }),
          );
    const created = openingResult?.account ?? (await firstValueFrom(this.client.createAccount(accountRequest)));
    const account: Account = {
      id: created.id,
      name: created.name,
      type,
      currency: created.currency,
      openingBalance: 0,
      lastFour: created.lastFour ?? undefined,
      issuerId: created.issuerEntity?.id,
    };
    this.store.data.update((data) => ({ ...data, accounts: [...data.accounts, account] }));
    if (openingResult) {
      const movement = openingResult.openingMovement;
      this.store.data.update((data) => ({
        ...data,
        movements: [pataDeApertura(movement, created.id, name), ...data.movements],
      }));
    }
    this.store.form.set(null);
  }

  async updateAccount(
    account: Account,
    changes: { name: string; lastFour?: string; credit?: CondicionesDeTarjeta; issuerId?: string },
  ) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    const lastFour = changes.lastFour?.trim() || undefined;
    if (lastFour && !/^\d{4}$/.test(lastFour)) throw new Error(this.i18n.t('form.account.error.lastFour'));
    const credito = account.type === 'credit' ? changes.credit : undefined;
    if (account.type === 'credit' && (!credito || credito.limit <= 0))
      throw new Error(this.i18n.t('form.account.error.creditLimit'));
    if (credito) {
      const actual = (await firstValueFrom(this.client.cards())).find((card) => card.id === account.id);
      if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
      await firstValueFrom(
        this.client.updateCard(account.id, {
          name,
          creditLimit: { amount: String(credito.limit), currency: actual.currency },
          cycle: { statementDay: credito.cutDay, paymentDueDay: credito.dueDay },
          terms: conPrioridad(conTasa(actual.terms, credito.monthlyRate), credito),
          issuer: actual.issuer,
          lastFour: lastFour ?? null,
          isActive: actual.isActive,
          issuerEntity: credito.issuerId || null,
        }),
      );
    } else {
      const actual = (await firstValueFrom(this.client.accounts())).find((item) => item.id === account.id);
      if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
      await firstValueFrom(
        this.client.updateAccount(account.id, {
          name,
          institution: actual.institution,
          lastFour: lastFour ?? null,
          isDefault: actual.isDefault,
          isActive: actual.isActive,
          issuerEntity: changes.issuerId === undefined ? (actual.issuerEntity?.id ?? null) : changes.issuerId || null,
        }),
      );
    }

    const actualizada: Account = {
      ...account,
      name,
      lastFour,
      ...(credito
        ? {
            limit: credito.limit,
            cutDay: credito.cutDay,
            dueDay: credito.dueDay,
            issuerId: credito.issuerId || undefined,
            ...(credito.monthlyRate === undefined ? {} : { annualRate: tasaAnual(credito.monthlyRate) }),
            ...(credito.paymentPriority ? { paymentPriority: credito.paymentPriority } : {}),
            ...(credito.foreignPaymentPriority ? { foreignPaymentPriority: credito.foreignPaymentPriority } : {}),
            monthlyFee: credito.monthlyFee || undefined,
            ...(credito.dualCurrency === undefined ? {} : { dualCurrency: credito.dualCurrency }),
          }
        : changes.issuerId === undefined
          ? {}
          : { issuerId: changes.issuerId || undefined }),
    };
    this.store.data.update((data) => ({
      ...data,
      accounts: data.accounts.map((item) => (item.id === account.id ? actualizada : item)),
    }));
    this.store.form.set(null);
  }
}

/** Pata de ingreso del saldo de apertura creada por el backend. */
function pataDeApertura(movement: ApiMovement, accountId: string, name: string): Movement {
  return {
    id: movement.id,
    date: movement.date,
    description: movement.description ?? `Saldo de apertura · ${name}`,
    accountId,
    category: 'Apertura',
    kind: 'income',
    amount: parseMoney(movement.amount.base),
    status: 'confirmed',
  };
}
