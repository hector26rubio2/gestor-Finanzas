import { inject, Injectable, Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Account, Movement, Person } from './view-model';
import { FinanceApiClient } from '@core/api/api-client';
import type { ApiMovement, CreateMovementBody } from '@core/api/ledger.api';
import { SHARE_BASIS } from '@core/api/purchases.api';
import { parseMoney } from '@core/utils/money';
import { I18nService } from '@core/i18n';
import { CashFlow, EconomicEffect, MovementKind, signOf } from '@core/utils/movement-kinds';
import { anualDesdeMensual } from '@core/utils/tasas';
import { LOAN_CARD_MODE, LOAN_PRODUCT, OBLIGATION_DIRECTION } from '@core/api/obligations.api';
import { AppStore } from './store';

type DatosDeMovimiento = {
  kind: string;
  date: string;
  description: string;
  accountId: string;
  targetId?: string;
  amount: number;
  category: string;
  person?: string;
  id?: string;
  notificationId?: string;
  ownership?: Movement['ownership'];
  recurring?: boolean | string;
  recurrence?: Movement['recurrence'];
  installmentCurrent?: number;
  installmentTotal?: number;
  purchaseApr?: number;
  cardBucket?: number;
  loanRole?: Movement['loanRole'];
  loanProduct?: Movement['loanProduct'];
  originalCurrency?: Movement['originalCurrency'];
  originalAmount?: number;
  exchangeRate?: number;
  operationType?: string;
  counterpartyId?: string;
  monthlyRate?: number;
  termMonths?: number;
  cardMode?: 'purchase' | 'cashAdvance';
  installmentRate?: number;
};

function cambiaElRegistro(original: Movement, input: DatosDeMovimiento): boolean {
  const moneda = input.originalCurrency ?? 'COP';
  return (
    original.date !== input.date ||
    original.accountId !== input.accountId ||
    original.kind !== input.kind ||
    Math.abs(original.amount) !== input.amount ||
    (original.installmentTotal ?? 1) !== (Number(input.installmentTotal) || 1) ||
    (original.originalCurrency ?? 'COP') !== moneda ||
    (moneda === 'USD' && original.originalAmount !== input.originalAmount)
  );
}

@Injectable({ providedIn: 'root' })
export class MovementCommands {
  private readonly store = inject(AppStore);
  private readonly injector = inject(Injector);
  private readonly i18n = inject(I18nService);

  async save(input: DatosDeMovimiento) {
    const esFinanciacion = input.operationType === 'loan' || input.operationType === 'credit';
    const cuotas = Number(input.installmentTotal) > 1 ? Number(input.installmentTotal) : undefined;
    const aprPropia =
      cuotas === undefined || input.installmentRate === undefined || input.installmentRate === null
        ? undefined
        : anualDesdeMensual(Number(input.installmentRate));
    const contraparte = this.store.data().people.find((persona) => persona.id === input.counterpartyId);
    if (!Number.isFinite(input.amount) || input.amount <= 0)
      throw new Error(this.i18n.t('form.movement.error.amountPositive'));
    if (input.operationType === 'borrowedCard') return this.saveBorrowedCard(input, contraparte);
    if (!this.store.account(input.accountId)) throw new Error(this.i18n.t('form.movement.error.accountInvalid'));
    if (
      (input.kind === 'payment' || input.kind === 'transfer' || input.kind === 'advance') &&
      (!input.targetId || input.targetId === input.accountId || !this.store.account(input.targetId))
    )
      throw new Error(this.i18n.t('form.movement.error.targetDifferent'));
    if (esFinanciacion && !input.id) return this.saveLoan(input, contraparte);
    if (input.id) {
      const original = this.store.data().movements.find((item) => item.id === input.id);
      if (original && cambiaElRegistro(original, input)) return this.correct(original, input, cuotas, aprPropia);
      const category = this.store.categories().find((item) => item.name === input.category);
      const updated = await firstValueFrom(
        this.injector.get(FinanceApiClient).reclassifyMovement(input.id, {
          category: category?.id ?? null,
          description: input.description || null,
        }),
      );
      this.store.data.update((data) => ({
        ...data,
        movements: data.movements.map((item) =>
          item.id === input.id
            ? { ...item, description: updated.description ?? input.description, category: input.category }
            : item,
        ),
      }));
      this.invalidarListadoRemoto();
      this.store.form.set(null);
      return;
    }
    const account = this.store.account(input.accountId);
    if (!account) throw new Error(this.i18n.t('form.movement.error.accountInvalid'));
    if (input.kind === 'transfer' || input.kind === 'advance' || input.kind === 'payment') {
      const amount = { amount: String(input.amount), currency: account.currency };
      const idempotencyKey = crypto.randomUUID();
      const client = this.injector.get(FinanceApiClient);
      const operation = await firstValueFrom(
        input.kind === 'payment'
          ? client.createCardPayment({
              date: input.date,
              amount,
              account: input.accountId,
              card: input.targetId!,
              description: input.description,
              idempotencyKey,
            })
          : input.kind === 'advance'
            ? client.createCashAdvance({
                date: input.date,
                amount,
                card: input.accountId,
                account: input.targetId!,
                description: input.description,
                idempotencyKey,
                installments: cuotas,
                apr: aprPropia,
              })
            : client.createTransfer({
                date: input.date,
                amount,
                sourceAccount: input.accountId,
                destinationAccount: input.targetId!,
                description: input.description,
                idempotencyKey,
              }),
      );
      const movementSubtype = input.kind === 'transfer' ? 'transfer' : input.kind === 'advance' ? 'advance' : undefined;
      const created = operation.legs.map<Movement>((leg) => {
        const legAmount = parseMoney(leg.amount.base) * signOf(leg.flow, leg.effect);
        return {
          id: leg.id,
          date: leg.date,
          description: leg.description ?? input.description,
          accountId: leg.links['account'] ?? leg.links['card'] ?? '',
          category: 'Transferencias',
          kind: input.kind === 'payment' ? 'payment' : legAmount < 0 ? 'expense' : 'income',
          movementSubtype,
          amount: legAmount,
          status: 'confirmed',
        };
      });
      this.store.data.update((data) => ({ ...data, movements: [...created, ...data.movements] }));
      this.invalidarListadoRemoto();
      this.store.form.set(null);
      return;
    }
    const tercero = this.terceroResponsable(input);
    if (tercero && account.type !== 'credit')
      return this.saveLoan({ ...input, kind: 'expense', operationType: 'loan' }, tercero);
    const created = await firstValueFrom(
      this.injector.get(FinanceApiClient).createMovement(this.cuerpoDeMovimiento(input, account, cuotas, aprPropia)),
    );
    if (tercero)
      await firstValueFrom(
        this.injector.get(FinanceApiClient).createSharedPurchase({
          purchaseMovement: created.id,
          shares: [{ counterparty: tercero.id, basis: SHARE_BASIS.full }],
          description: input.description || null,
        }),
      );
    this.store.data.update((data) => ({
      ...data,
      movements: [
        { ...this.aMovimiento(created, input, account, cuotas), ...(tercero ? { ownership: 'loaned' as const } : {}) },
        ...data.movements,
      ],
    }));
    this.store.form.set(null);
    this.invalidarListadoRemoto();
  }

  private terceroResponsable(input: DatosDeMovimiento): Person | undefined {
    if (input.kind !== 'expense' || !input.person) return undefined;
    return this.store.data().people.find((persona) => persona.name === input.person);
  }

  private async saveBorrowedCard(input: DatosDeMovimiento, prestamista: Person | undefined) {
    if (!prestamista) throw new Error(this.i18n.t('form.movement.error.counterpartyRequired'));
    await firstValueFrom(
      this.injector.get(FinanceApiClient).createLoan({
        date: input.date,
        direction: OBLIGATION_DIRECTION.payable,
        counterparty: prestamista.id,
        amount: { amount: String(input.amount), currency: this.store.baseCurrency() },
        product: LOAN_PRODUCT.informal,
        description: input.description || undefined,
        idempotencyKey: crypto.randomUUID(),
        borrowedCard: true,
      }),
    );
    this.invalidarListadoRemoto();
    this.store.form.set(null);
  }

  private async correct(original: Movement, input: DatosDeMovimiento, cuotas?: number, aprPropia?: number) {
    if (original.movementSubtype || original.kind === 'payment' || original.loanRole)
      throw new Error(this.i18n.t('form.movement.error.operationNotCorrectable'));
    const account = this.store.account(input.accountId);
    if (!account) throw new Error(this.i18n.t('form.movement.error.accountInvalid'));
    const created = await firstValueFrom(
      this.injector.get(FinanceApiClient).correctMovement(original.id, {
        replacement: this.cuerpoDeMovimiento(input, account, cuotas, aprPropia),
      }),
    );
    this.store.data.update((data) => ({
      ...data,
      movements: [
        this.aMovimiento(created, input, account, cuotas),
        ...data.movements.filter((item) => item.id !== original.id),
      ],
    }));
    const abierto = this.store.inspector();
    if (abierto?.id === original.id) this.store.inspector.set({ ...abierto, id: created.id });
    this.store.form.set(null);
    this.invalidarListadoRemoto();
  }

  private cuerpoDeMovimiento(
    input: DatosDeMovimiento,
    account: Account,
    cuotas: number | undefined,
    aprPropia: number | undefined,
  ): CreateMovementBody {
    const isIncome = input.kind === 'income';
    const isCard = account.type === 'credit';
    const categoria = this.store.categories().find((item) => item.name === input.category);
    const personas = this.store.data().people;
    const persona =
      personas.find((item) => item.id === input.counterpartyId) ?? personas.find((item) => item.name === input.person);
    return {
      date: input.date,
      kind: isIncome ? MovementKind.income : isCard ? MovementKind.cardPurchase : MovementKind.expense,
      effect: isIncome ? EconomicEffect.income : EconomicEffect.expense,
      flow: isIncome ? CashFlow.inflow : CashFlow.outflow,
      amount: {
        amount: String(input.originalCurrency === 'USD' ? input.originalAmount : input.amount),
        currency: input.originalCurrency ?? account.currency,
      },
      links: {
        ...(isCard ? { card: input.accountId } : { account: input.accountId }),
        ...(categoria ? { category: categoria.id } : {}),
        ...(persona ? { counterparty: persona.id } : {}),
      },
      rate: input.originalCurrency === 'USD' ? String(input.exchangeRate) : undefined,
      rateAsOf: input.originalCurrency === 'USD' ? input.date : undefined,
      description: input.description,
      idempotencyKey: crypto.randomUUID(),
      purchaseApr: isCard ? aprPropia : undefined,
      installments: isCard ? cuotas : undefined,
      cardBucket: isCard && input.cardBucket ? input.cardBucket : undefined,
    };
  }

  private aMovimiento(created: ApiMovement, input: DatosDeMovimiento, account: Account, cuotas?: number): Movement {
    const isCard = account.type === 'credit';
    return {
      id: created.id,
      date: created.date,
      description: created.description ?? input.description,
      accountId: input.accountId,
      category: created.linkNames['category']?.name ?? input.category,
      kind: input.kind as Movement['kind'],
      amount: parseMoney(created.amount.base) * signOf(created.flow, created.effect),
      status: 'confirmed',
      person: created.linkNames['counterparty']?.name ?? input.person,
      ownership: created.links['counterparty'] ? 'loaned' : 'own',
      recurring: input.recurring === true || input.recurring === 'true',
      purchaseApr: created.purchaseApr ?? undefined,
      ...(created.cardBucket ? { cardBucket: created.cardBucket } : {}),
      ...(isCard && cuotas ? { installmentTotal: cuotas, installmentCurrent: 1 } : {}),
    };
  }

  private async saveLoan(
    input: {
      kind: string;
      date: string;
      description: string;
      accountId: string;
      amount: number;
      operationType?: string;
      loanProduct?: Movement['loanProduct'];
      monthlyRate?: number;
      termMonths?: number;
      cardMode?: 'purchase' | 'cashAdvance';
    },
    contraparte: Person | undefined,
  ) {
    if (!contraparte) throw new Error(this.i18n.t('form.movement.error.counterpartyRequired'));
    const cuenta = this.store.account(input.accountId);
    if (!cuenta) throw new Error(this.i18n.t('form.movement.error.accountInvalid'));
    const recibido = input.kind === 'income';
    const esCredito = input.operationType === 'credit';
    const conTarjeta = cuenta.type === 'credit';
    const tasa = input.monthlyRate === undefined || input.monthlyRate === null ? undefined : Number(input.monthlyRate);
    const plazo = Number(input.termMonths) > 0 ? Math.round(Number(input.termMonths)) : undefined;
    const producto = esCredito ? (input.loanProduct ?? 'personal') : undefined;
    const base: Omit<Movement, 'id' | 'amount'> = {
      date: input.date,
      description: input.description || contraparte.name,
      accountId: cuenta.id,
      category: '',
      kind: recibido ? 'income' : 'expense',
      status: 'confirmed',
      person: contraparte.name,
      ownership: 'loaned',
      loanRole: recibido ? 'borrowed' : 'lent',
      loanProduct: producto,
      ...(plazo ? { installmentTotal: plazo, installmentCurrent: 1 } : {}),
      ...(tasa !== undefined ? { purchaseApr: anualDesdeMensual(tasa) } : {}),
    };
    const creado = await firstValueFrom(
      this.injector.get(FinanceApiClient).createLoan({
        date: input.date,
        direction: recibido ? OBLIGATION_DIRECTION.payable : OBLIGATION_DIRECTION.receivable,
        counterparty: contraparte.id,
        amount: { amount: String(input.amount), currency: cuenta.currency },
        ...(conTarjeta
          ? { card: cuenta.id, cardMode: LOAN_CARD_MODE[input.cardMode ?? 'purchase'] }
          : { account: cuenta.id }),
        product: producto ? LOAN_PRODUCT[producto] : LOAN_PRODUCT.informal,
        monthlyRate: tasa === undefined ? undefined : tasa / 100,
        termMonths: plazo,
        description: input.description || undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    const movimientos = creado.movements.map<Movement>((pata) => ({
      ...base,
      id: pata.id,
      amount: parseMoney(pata.amount.base) * (recibido ? 1 : -1),
    }));
    this.store.data.update((data) => ({ ...data, movements: [...movimientos, ...data.movements] }));

    this.invalidarListadoRemoto();
    this.store.form.set(null);
  }

  /**
   * Tras un comando exitoso el listado remoto quedó atrás: obliga a que el libro
   * de movimientos recargue desde la página 1 (ver MovementsBookService).
   *
   * Distinto de `RemoteBootstrap.reiniciarMovimientos`: deliberadamente NO limpia
   * `movimientosCargados`, para que los movimientos optimistas ya conocidos
   * (calendario/día) sobrevivan mientras el libro recarga.
   */
  private invalidarListadoRemoto(): void {
    this.store.movimientosListos.set(false);
    this.store.remoteMovementPage.set(1);
    this.store.remoteMovementCursor.set(null);
    this.store.remoteMovementTotals.set(null);
    this.store.remoteMovementTotal.set(0);
  }
}
