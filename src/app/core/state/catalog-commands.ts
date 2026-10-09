import { inject, Injectable, Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Account, Person, PersonKind } from './view-model';
import { FinanceApiClient, viewTypeToAccountKind } from '@core/api/api-client';
import { baseCurrency, parseMoney } from '@core/utils/money';
import { I18nService } from '@core/i18n';
import { anualDesdeMensual } from '@core/utils/tasas';
import { COUNTERPARTY_KIND } from '@core/api/people.api';
import { PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS, completarPrioridad } from '@core/api/card-buckets';
import { AppStore, type CondicionesDeTarjeta } from './store';

function conPrioridad(terms: unknown, credito: CondicionesDeTarjeta): unknown {
  if (!terms || typeof terms !== 'object') return terms;
  return {
    ...terms,
    ...(credito.paymentPriority ? { paymentPriority: credito.paymentPriority } : {}),
    ...(credito.foreignPaymentPriority ? { foreignPaymentPriority: credito.foreignPaymentPriority } : {}),
    ...(credito.monthlyFee !== undefined
      ? { monthlyFee: credito.monthlyFee > 0 ? { amount: String(credito.monthlyFee), currency: baseCurrency() } : null }
      : {}),
    ...(credito.dualCurrency !== undefined ? { dualCurrency: credito.dualCurrency } : {}),
  };
}

function conTasa(terms: unknown, mensual: number | undefined): unknown {
  if (mensual === undefined || !terms || typeof terms !== 'object') return terms;
  const tasa = { rate: String(anualDesdeMensual(mensual) / 100) };
  return { ...terms, purchaseApr: tasa, cashAdvanceApr: tasa };
}

@Injectable({ providedIn: 'root' })
export class CatalogCommands {
  private readonly store = inject(AppStore);
  private readonly injector = inject(Injector);
  private readonly i18n = inject(I18nService);

  async createCounterparty(name: string, kind: PersonKind = 'person', email?: string): Promise<Person> {
    const nombre = name.trim();
    if (!nombre) throw new Error(this.i18n.t('form.error.nameRequired'));
    const creada: Person = await firstValueFrom(
      this.injector.get(FinanceApiClient).createPerson({
        displayName: nombre,
        email: email || null,
        kind: kind === 'institution' ? COUNTERPARTY_KIND.institution : COUNTERPARTY_KIND.person,
      }),
    ).then((respuesta) => ({ id: respuesta.id, name: respuesta.displayName, owed: 0, owing: 0, kind, email }));
    this.store.data.update((data) => ({ ...data, people: [...data.people, creada] }));
    return creada;
  }

  async createAccount(
    name: string,
    type: Account['type'],
    opening: number,
    currency = baseCurrency(),
    exchangeRate?: number,
    credit?: CondicionesDeTarjeta,
    lastFour?: string,
    issuerId?: string,
  ) {
    const digitos = lastFour?.trim() || undefined;
    if (digitos && !/^\d{4}$/.test(digitos)) throw new Error(this.i18n.t('form.account.error.lastFour'));
    const anual = credit?.monthlyRate === undefined ? undefined : anualDesdeMensual(credit.monthlyRate);
    const tasaApi = String((anual ?? 0) / 100);
    if (opening < 0) throw new Error(this.i18n.t('form.account.error.openingNegative'));
    const client = this.injector.get(FinanceApiClient);
    if (type === 'credit') {
      if (!credit || credit.limit <= 0) throw new Error(this.i18n.t('form.account.error.creditLimit'));
      const created = await firstValueFrom(
        client.createCard({
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
        accounts: [
          ...data.accounts,
          {
            id: created.id,
            name: created.name,
            type: 'credit',
            currency: created.currency,
            openingBalance: 0,
            limit: parseMoney(created.creditLimit),
            lastFour: created.lastFour ?? undefined,
            cutDay: created.cycle.statementDay,
            dueDay: created.cycle.paymentDueDay,
            annualRate: anual,
            issuerId: created.issuerEntity?.id,
            paymentPriority: completarPrioridad(created.terms?.paymentPriority, PRIORIDAD_EN_PESOS),
            foreignPaymentPriority: completarPrioridad(created.terms?.foreignPaymentPriority, PRIORIDAD_EN_DOLARES),
            ...(credit.monthlyFee ? { monthlyFee: credit.monthlyFee } : {}),
            dualCurrency: created.terms?.dualCurrency === true,
          },
        ],
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
            client.createAccountWithOpening({
              account: accountRequest,
              openingBalance: { amount: String(Math.abs(opening)), currency },
              date: new Date().toISOString().slice(0, 10),
              rate: currency === 'USD' ? String(exchangeRate) : null,
              rateAsOf: currency === 'USD' ? new Date().toISOString().slice(0, 10) : null,
              idempotencyKey: crypto.randomUUID(),
            }),
          );
    const created = openingResult?.account ?? (await firstValueFrom(client.createAccount(accountRequest)));
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
        movements: [
          {
            id: movement.id,
            date: movement.date,
            description: movement.description ?? `Saldo de apertura · ${name}`,
            accountId: created.id,
            category: 'Apertura',
            kind: 'income',
            amount: parseMoney(movement.amount.base),
            status: 'confirmed',
          },
          ...data.movements,
        ],
      }));
    }
    this.store.form.set(null);
  }

  async createCategory(name: string, color: string, icon: string, kind: 'income' | 'expense' = 'expense') {
    const type = kind === 'income' ? 1 : 2;
    const created = await firstValueFrom(
      this.injector.get(FinanceApiClient).createCategory({ name, type, color, icon }),
    );
    this.store.categories.update((items) => [...items, created]);

    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.category.created', { name }));
  }

  async createPerson(
    name: string,
    email?: string,
    relationship: Person['relationship'] = 'Otro',
    kind: PersonKind = 'person',
  ) {
    const creada = await this.createCounterparty(name, kind, email || undefined);
    this.store.data.update((data) => ({
      ...data,
      people: data.people.map((persona) => (persona.id === creada.id ? { ...persona, relationship } : persona)),
    }));
    this.store.form.set(null);
    this.store.toast.set(
      this.i18n.t(kind === 'institution' ? 'toast.institution.created' : 'toast.person.created', { name }),
    );
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
    const client = this.injector.get(FinanceApiClient);
    if (credito) {
      const actual = (await firstValueFrom(client.cards())).find((card) => card.id === account.id);
      if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
      await firstValueFrom(
        client.updateCard(account.id, {
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
      const actual = (await firstValueFrom(client.accounts())).find((item) => item.id === account.id);
      if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
      await firstValueFrom(
        client.updateAccount(account.id, {
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
            ...(credito.monthlyRate === undefined ? {} : { annualRate: anualDesdeMensual(credito.monthlyRate) }),
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

  async updateCategory(id: string, changes: { name: string; color: string; icon: string }) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    const actual = this.store.categories().find((category) => category.id === id);
    if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
    const guardada = await firstValueFrom(
      this.injector.get(FinanceApiClient).updateCategory(id, {
        name,
        color: changes.color,
        icon: changes.icon,
        parent: actual.parent,
        isActive: actual.isActive,
      }),
    );
    this.store.categories.update((items) => items.map((item) => (item.id === id ? guardada : item)));
    if (actual.name !== guardada.name)
      this.store.data.update((data) => ({
        ...data,
        movements: data.movements.map((movement) =>
          movement.category === actual.name ? { ...movement, category: guardada.name } : movement,
        ),
      }));
    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.category.updated', { name: guardada.name }));
  }

  async updatePerson(
    id: string,
    changes: { name: string; email?: string; relationship?: Person['relationship']; kind?: PersonKind },
  ) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    const actual = this.store.data().people.find((person) => person.id === id);
    if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
    const email = changes.email?.trim() || undefined;
    const client = this.injector.get(FinanceApiClient);
    const remota = (await firstValueFrom(client.people())).find((person) => person.id === id);
    if (!remota) throw new Error(this.i18n.t('form.error.notFound'));
    await firstValueFrom(
      client.updatePerson(id, {
        displayName: name,
        alias: remota.alias,
        email: email ?? null,
        phone: remota.phone,
        notes: remota.notes,
        isActive: remota.isActive,
        ...(changes.kind
          ? { kind: changes.kind === 'institution' ? COUNTERPARTY_KIND.institution : COUNTERPARTY_KIND.person }
          : {}),
      }),
    );

    this.store.data.update((data) => ({
      ...data,
      people: data.people.map((person) =>
        person.id === id
          ? {
              ...person,
              name,
              email,
              relationship: changes.relationship ?? person.relationship,
              kind: changes.kind ?? person.kind,
            }
          : person,
      ),
      movements: data.movements.map((movement) =>
        movement.person === actual.name ? { ...movement, person: name } : movement,
      ),
    }));
    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.person.updated', { name }));
  }

  async updateInvestment(id: string, changes: { name: string; instrumentType: string }) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    if (!this.store.data().investments.some((investment) => investment.id === id))
      throw new Error(this.i18n.t('form.error.notFound'));
    const client = this.injector.get(FinanceApiClient);
    const remota = (await firstValueFrom(client.investments())).find((investment) => investment.id === id);
    if (!remota) throw new Error(this.i18n.t('form.error.notFound'));
    await firstValueFrom(
      client.updateInvestment(id, {
        name,
        instrumentType: changes.instrumentType,
        risk: remota.risk ?? 2,
        symbol: remota.symbol ?? null,
        isActive: remota.isActive,
      }),
    );

    this.store.data.update((data) => ({
      ...data,
      investments: data.investments.map((investment) =>
        investment.id === id ? { ...investment, name, type: changes.instrumentType } : investment,
      ),
    }));
    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.investment.updated', { name }));
  }

  async createInvestment(name: string, instrumentType: string, currency: string) {
    const created = await firstValueFrom(
      this.injector.get(FinanceApiClient).createInvestment({ name, instrumentType, currency, risk: 2 }),
    );
    this.store.data.update((data) => ({
      ...data,
      investments: [
        ...data.investments,
        {
          id: created.id,
          name: created.name,
          type: created.instrumentType,
          cost: parseMoney(created.costBasis),
          value: parseMoney(created.marketValue ?? created.costBasis),
          institution: 'Sin especificar',
          currency,
          units: 0,
          risk: 'Medio',
          liquidity: 'Programada',
        },
      ],
    }));

    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.investment.created', { name }));
  }

  async createRecurrence(name: string, amount: number, accountId: string, frequency: number, start: string) {
    const account = this.store.account(accountId);
    if (!account) throw new Error(this.i18n.t('form.recurrence.error.accountInvalid'));
    await firstValueFrom(
      this.injector.get(FinanceApiClient).createRecurrence({
        name,
        movementTemplate: account.type === 'credit' ? 20 : 2,
        amount: { amount: String(amount), currency: account.currency },
        target: account.type === 'credit' ? { card: accountId } : { account: accountId },
        schedule: {
          frequency,
          interval: 1,
          start,
          end: null,
          dayOfMonth: frequency === 3 ? Number(start.slice(-2)) : null,
          dayOfWeek: null,
        },
      }),
    );

    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.recurrence.created', { name }));
  }
}
