import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '@ui/icon';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { FinanceApiClient, ApiWritesBus, CARD_BUCKET, PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS, claveDeConcepto, completarPrioridad } from '@core/api';
import type { ApiSharedPurchase, ApiSettlement } from '@core/api';
import { parseMoney, formatReturnRate, sumBy } from '@core/utils';
import { I18nService } from '@core/i18n';
import { PERMISO_DE_REVERSO, familiaDeMovimiento, P, toMovement } from '@core/session';
import { permisoParaEditarCuenta } from '@features/account-form';
import type { Account, Movement } from '@core/state';
import { CAPABILITIES, AppStore, FEATURES } from '@core/state';
import { SIN_DATO } from '@shared/utils';
import { MovementsBookService } from '@shared/movements';
import { BankCardComponent } from '@ui/bank-card';
import { ConfirmDialogComponent } from '@ui/confirm-dialog';
import { DataTableComponent } from '@ui/data-table';
import { OverlayComponent } from '@ui/overlay';
import { UiSelectComponent } from '@ui/select';
import { aplicarAbono, comprasPendientes, saldosPorConcepto } from '@shared/tarjetas';

interface ApiCardStatus {
  debt: { amount: string; currency: string };
  availableCredit: { amount: string; currency: string };
  minimumPayment: { amount: string; currency: string };
  currentPeriod: { range: { start: string; end: string }; statementDate: string; dueDate: string };
}

@Component({
  selector: 'fin-inspector',
  imports: [
    IconComponent,
    NgTemplateOutlet,
    FormsModule,
    HlmButton,
    HlmInput,
    BankCardComponent,
    ConfirmDialogComponent,
    DataTableComponent,
    OverlayComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspector.html',
})
export class InspectorComponent {
  readonly Math = Math;
  readonly i18n = inject(I18nService);
  readonly store = inject(AppStore);
  readonly P = P;
  readonly parseMoney = parseMoney;
  private readonly capabilities = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  private readonly api = inject(FinanceApiClient);
  private readonly movementsBook = inject(MovementsBookService);
  private readonly escrituras = inject(ApiWritesBus);

  readonly canReverseSelected = computed(() => {
    const movimiento = this.selectedMovement();
    if (!movimiento || !this.can(P.movimientos.deshabilitar)) return false;
    const familia = familiaDeMovimiento(movimiento, this.store.account(movimiento.accountId)?.type);
    return !familia || this.can(PERMISO_DE_REVERSO[familia]);
  });
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly cardPaymentAmount = signal(500000);
  readonly cuentaDeOrigen = signal('');
  readonly cuentasDeOrigen = computed(() => this.store.data().accounts.filter((a) => a.type !== 'credit'));
  private readonly origenPorDefecto = effect(() => {
    const cuentas = this.cuentasDeOrigen();
    if (!cuentas.some((c) => c.id === untracked(this.cuentaDeOrigen)))
      this.cuentaDeOrigen.set((cuentas.find((c) => c.type === 'savings') ?? cuentas[0])?.id ?? '');
  });
  readonly opcionesDeOrigen = computed(() => this.cuentasDeOrigen().map((c) => ({ value: c.id, label: c.name })));
  readonly movimientosDeTarjeta = signal<readonly Movement[]>([]);
  readonly estadoDeTarjeta = signal<ApiCardStatus | null>(null);
  private readonly traerTarjeta = effect(() => {
    const tarjeta = this.selectedAccount();
    this.escrituras.version();
    if (!tarjeta || tarjeta.type !== 'credit') return;
    untracked(() => {
      void this.cargarTarjeta(tarjeta.id);
    });
  });
  private async cargarTarjeta(id: string): Promise<void> {
    const catalogo = this.store.kindCatalog();
    const movimientos: Movement[] = [];
    try {
      for (let pagina = 1; pagina <= 20; pagina++) {
        const respuesta = await firstValueFrom(
          this.api.movements({ page: pagina, pageSize: 100, filter: { cards: [id] } }),
        );
        movimientos.push(...respuesta.items.map((m) => toMovement(this.i18n, catalogo, m)));
        if (!respuesta.hasNext) break;
      }
    } catch {
      movimientos.length = 0;
    }
    if (this.selectedAccount()?.id !== id) return;
    this.movimientosDeTarjeta.set(movimientos);
    try {
      this.estadoDeTarjeta.set((await firstValueFrom(this.api.cardStatus(id))) as ApiCardStatus);
    } catch {
      this.estadoDeTarjeta.set(null);
    }
  }
  readonly prioridadDeTarjeta = computed(() => {
    const tarjeta = this.selectedAccount();
    return tarjeta?.currency && tarjeta.currency !== 'COP'
      ? completarPrioridad(tarjeta.foreignPaymentPriority, PRIORIDAD_EN_DOLARES)
      : completarPrioridad(tarjeta?.paymentPriority, PRIORIDAD_EN_PESOS);
  });
  readonly comprasPendientes = computed(() => comprasPendientes(this.movimientosDeTarjeta()));
  readonly saldosPorConcepto = computed(() => saldosPorConcepto(this.comprasPendientes(), this.prioridadDeTarjeta()));
  readonly cardPurchases = computed(() => {
    const ids = new Set(this.comprasPendientes().map((c) => c.id));
    return this.movimientosDeTarjeta().filter((m) => ids.has(m.id));
  });
  readonly cardDebt = computed(() => {
    const estado = this.estadoDeTarjeta();
    if (estado) return parseMoney(estado.debt);
    const account = this.selectedAccount();
    return account
      ? Math.max(0, -this.store.balance(account)) || sumBy(this.comprasPendientes(), (c) => c.pendiente)
      : 0;
  });
  readonly pagoMinimo = computed(() => {
    const estado = this.estadoDeTarjeta();
    return estado ? parseMoney(estado.minimumPayment) : null;
  });
  readonly periodoActual = computed(() => this.estadoDeTarjeta()?.currentPeriod ?? null);
  etiquetaDeConcepto(concepto: number): string {
    return this.i18n.t(`card.bucket.${claveDeConcepto(concepto) ?? 'fees'}`);
  }
  readonly paymentAllocation = computed(() =>
    aplicarAbono(this.saldosPorConcepto(), Math.min(this.cardPaymentAmount(), this.cardDebt() || Infinity)),
  );
  readonly appliedPayment = computed(() => sumBy(this.paymentAllocation(), (row) => row.aplicado));
  readonly paymentAllocationRows = computed(() =>
    this.paymentAllocation().map((row, indice) => ({
      id: String(row.concepto),
      order: String(indice + 1),
      description: this.etiquetaDeConcepto(row.concepto),
      installment: String(this.saldosPorConcepto()[indice]?.compras.length ?? 0),
      before: this.store.money(row.antes),
      applied: this.store.money(row.aplicado),
      after: this.store.money(row.despues),
    })),
  );
  readonly paymentAllocationColumns = computed(() => [
    { key: 'order', label: '#' },
    { key: 'description', label: this.i18n.t('workspace.cardPayment.table.bucket') },
    { key: 'installment', label: this.i18n.t('workspace.cardPayment.table.purchases') },
    { key: 'before', label: this.i18n.t('workspace.cardPayment.table.balanceBefore') },
    { key: 'applied', label: this.i18n.t('workspace.cardPayment.table.applied') },
    { key: 'after', label: this.i18n.t('workspace.cardPayment.table.balanceAfter') },
  ]);
  readonly cardStatementPurchases = computed(() => {
    const periodo = this.periodoActual();
    const compras = this.movimientosDeTarjeta().filter((m) => m.kind === 'expense' && m.amount < 0);
    const delPeriodo = periodo
      ? compras.filter((m) => m.date >= periodo.range.start && m.date <= periodo.range.end)
      : compras.filter((m) => m.date.slice(0, 7) === this.store.hoy().slice(0, 7));
    return sumBy(delPeriodo, (m) => Math.abs(m.amount));
  });
  readonly nextInstallments = computed(() =>
    sumBy(this.comprasPendientes(), (c) => Math.min(c.pendiente, c.cuotaDelMes)),
  );
  readonly cardEstimatedInterest = computed(() => {
    const tasaTarjeta = this.selectedAccount()?.annualRate;
    const porId = new Map(this.movimientosDeTarjeta().map((m) => [m.id, m]));
    const intereses = this.comprasPendientes().map((compra) => {
      if (
        compra.concepto === CARD_BUCKET.zeroRatePurchases ||
        compra.concepto === CARD_BUCKET.singleInstallmentPurchases
      )
        return 0;
      const anual = porId.get(compra.id)?.purchaseApr ?? tasaTarjeta;
      return anual !== undefined && anual !== null && Number.isFinite(anual)
        ? compra.pendiente * (anual / 100 / 12)
        : null;
    });
    if (intereses.every((x) => x === null)) return null;
    return Math.round(sumBy(intereses, (x) => x ?? 0));
  });
  readonly cardStatementTotal = computed(() =>
    Math.round(this.nextInstallments() + (this.cardEstimatedInterest() ?? 0)),
  );
  openDayMovement(id: string) {
    this.store.calendarReturnDate.set(this.store.inspector()?.id ?? this.store.selectedCalendarDate());
    this.store.inspect('movement', id);
  }
  returnToCalendarDay() {
    const date = this.store.calendarReturnDate();
    if (date) this.store.inspect('day', date);
  }
  async confirmCardPayment() {
    const card = this.selectedAccount();
    if (!card || this.appliedPayment() <= 0) return;
    await this.store.save({
      kind: 'payment',
      date: this.store.hoy(),
      accountId: this.cuentaDeOrigen(),
      targetId: card.id,
      description: `Abono a ${card.name}`,
      amount: this.appliedPayment(),
      category: 'Pago de tarjeta',
    });
    this.store.inspect('card', card.id);
    this.store.cardPaymentMode.set(false);
  }
  readonly selectedMovement = computed(() =>
    this.store.data().movements.find((m) => m.id === this.store.inspector()?.id),
  );
  readonly selectedAccount = computed(() => this.store.account(this.store.inspector()?.id ?? ''));
  /** El inspector muestra la tarjeta bonita y se ensancha solo para estos dos tipos. */
  readonly isAccountInspector = computed(() => {
    const type = this.store.inspector()?.type;
    return type === 'card' || type === 'account';
  });
  /** Deuda como numero positivo en una tarjeta; saldo tal cual en el resto. */
  displayBalance(account: Account): number {
    const value = this.store.balance(account);
    return account.type === 'credit' ? (value < 0 ? -value : 0) : value;
  }
  typeCardLabel(type: Account['type']): string {
    return this.i18n.t(`accounts.cards.type.${type}`);
  }
  readonly selectedPerson = computed(() => this.store.data().people.find((p) => p.id === this.store.inspector()?.id));
  readonly selectedInvestment = computed(() =>
    this.store.data().investments.find((i) => i.id === this.store.inspector()?.id),
  );
  readonly inspectorTitle = computed(() => {
    const s = this.store.inspector();
    if (s?.type === 'movement') return this.i18n.t('workspace.inspector.title.movement');
    if (s?.type === 'card') return this.selectedAccount()?.name ?? this.i18n.t('workspace.inspector.title.card');
    if (s?.type === 'day')
      return this.i18n.t('workspace.inspector.title.day', {
        date: new Intl.DateTimeFormat(this.store.preferences().locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
          new Date(`${s.id}T00:00:00Z`),
        ),
      });
    if (s?.type === 'person') return this.selectedPerson()?.name ?? this.i18n.t('workspace.inspector.title.person');
    if (s?.type === 'investment')
      return this.selectedInvestment()?.name ?? this.i18n.t('workspace.inspector.title.investment');
    return this.i18n.t('workspace.inspector.title.account');
  });
  readonly inspectorAmount = computed(() => {
    const m = this.selectedMovement(),
      a = this.selectedAccount(),
      p = this.selectedPerson(),
      i = this.selectedInvestment();
    return m
      ? this.store.money(m.amount)
      : a
        ? this.store.money(a.type === 'credit' ? Math.max(0, -this.store.balance(a)) : this.store.balance(a))
        : p
          ? this.store.money(p.owed - p.owing)
          : i
            ? this.store.money(i.value)
            : this.i18n.t('workspace.inspector.operationsCount', {
                count: this.store.dayMoves(this.store.inspector()?.id ?? this.store.selectedCalendarDate()).length,
              });
  });
  readonly inspectorSubtitle = computed(
    () =>
      this.selectedMovement()?.description ??
      this.selectedAccount()?.name ??
      this.selectedPerson()?.name ??
      this.selectedInvestment()?.type ??
      this.i18n.t('workspace.inspector.defaultSubtitle'),
  );
  readonly inspectorFacts = computed(() => {
    const m = this.selectedMovement(),
      a = this.selectedAccount(),
      p = this.selectedPerson(),
      i = this.selectedInvestment();
    const t = (key: string, params?: Record<string, string | number>) => this.i18n.t(key, params);
    if (m)
      return [
        [t('workspace.inspector.facts.date'), m.date],
        [t('workspace.inspector.facts.account'), this.store.account(m.accountId)?.name ?? SIN_DATO],
        [t('workspace.inspector.facts.category'), m.category],
        [
          t('workspace.inspector.facts.nature'),
          m.amount < 0 ? t('workspace.inspector.facts.debit') : t('workspace.inspector.facts.credit'),
        ],
        [t('workspace.inspector.facts.status'), m.status],
        [
          t('workspace.inspector.facts.responsibility'),
          m.person ? t('workspace.inspector.facts.loanedTo', { person: m.person }) : t('workspace.inspector.facts.own'),
        ],
        [
          t('workspace.inspector.facts.installments'),
          m.installmentTotal
            ? t('workspace.inspector.facts.installmentsOf', {
                current: m.installmentCurrent ?? 1,
                total: m.installmentTotal,
              })
            : t('workspace.inspector.facts.oneInstallment'),
        ],
        [
          t('workspace.inspector.facts.recurrence'),
          m.recurring
            ? (m.recurrence ?? t('workspace.inspector.facts.yes'))
            : t('workspace.inspector.facts.notRecurring'),
        ],
        [
          t('workspace.inspector.facts.loan'),
          m.loanRole === 'lent'
            ? t('workspace.inspector.facts.loanGiven')
            : m.loanRole === 'borrowed'
              ? t('workspace.inspector.facts.loanReceived')
              : m.loanRole === 'repayment'
                ? t('workspace.inspector.facts.loanRepayment')
                : t('workspace.inspector.facts.notApplicable'),
        ],
        [
          t('workspace.inspector.facts.originalCurrency'),
          m.originalCurrency === 'USD'
            ? t('workspace.inspector.facts.originalCurrencyValue', {
                amount: m.originalAmount ?? 0,
                rate: m.exchangeRate ?? 0,
              })
            : 'COP',
        ],
      ];
    if (a)
      return [
        [t('workspace.inspector.facts.lastFour'), a.lastFour ? '•••• ' + a.lastFour : SIN_DATO],
        [t('workspace.inspector.facts.currency'), a.currency],
        [
          t('workspace.inspector.facts.referenceRate'),
          a.currency === 'USD'
            ? (a.exchangeRate?.toLocaleString('es-CO') ?? t('workspace.inspector.facts.undefined'))
            : t('workspace.inspector.facts.notApplicable'),
        ],
        [
          t('workspace.inspector.facts.cutoff'),
          a.cutDay ? String(a.cutDay) : t('workspace.inspector.facts.notApplicable'),
        ],
        [
          t('workspace.inspector.facts.dueDate'),
          a.dueDay ? String(a.dueDay) : t('workspace.inspector.facts.notApplicable'),
        ],
        [
          t('workspace.inspector.facts.limit'),
          a.limit ? this.store.money(a.limit) : t('workspace.inspector.facts.notApplicable'),
        ],
      ];
    if (p)
      return [
        [t('workspace.inspector.facts.owed'), this.store.money(p.owed)],
        [t('workspace.inspector.facts.owing'), this.store.money(p.owing)],
        [t('workspace.inspector.facts.balance'), this.store.money(p.owed - p.owing)],
      ];
    if (i)
      return [
        [t('workspace.inspector.facts.type'), i.type],
        [t('workspace.inspector.facts.cost'), this.store.money(i.cost)],
        [t('workspace.inspector.facts.value'), this.store.money(i.value)],
        [t('workspace.inspector.facts.variation'), formatReturnRate(i.value, i.cost)],
      ];
    return [
      [t('workspace.inspector.facts.date'), this.store.inspector()?.id ?? this.store.selectedCalendarDate()],
      [
        t('workspace.inspector.facts.operations'),
        String(this.store.dayMoves(this.store.inspector()?.id ?? this.store.selectedCalendarDate()).length),
      ],
    ];
  });
  editSelected() {
    const m = this.selectedMovement();
    if (m) this.store.open(m.kind, m.accountId, m);
  }
  /**
   * Pide confirmar antes de reversar. El inspector es un `<dialog>` modal nativo, y el
   * overlay de CDK del diálogo de confirmación quedaría detrás de él: se cierra el
   * inspector mientras se pregunta y se restaura si la persona cancela.
   */
  askReverse(): void {
    const movement = this.selectedMovement();
    if (!movement) return;
    this.confirmKind.set('reverse');
    this.pendingConfirm.set({ kind: 'reverse', movement, restore: this.store.inspector() });
    this.store.inspector.set(null);
  }
  askDeactivateAccount(): void {
    const account = this.selectedAccount();
    if (!account || account.type === 'credit') return;
    this.confirmKind.set('deactivateAccount');
    this.pendingConfirm.set({ kind: 'deactivateAccount', account, restore: this.store.inspector() });
    this.store.inspector.set(null);
  }
  confirmPending(): void {
    const pending = this.pendingConfirm();
    this.pendingConfirm.set(null);
    if (pending?.kind === 'reverse') void this.reverseMovement(pending.movement);
    else if (pending?.kind === 'deactivateAccount') void this.deactivateAccount(pending.account);
  }
  dismissPending(): void {
    const pending = this.pendingConfirm();
    if (!pending) return;
    this.pendingConfirm.set(null);
    this.store.inspector.set(pending.restore);
  }
  readonly pendingConfirm = signal<
    | { kind: 'reverse'; movement: Movement; restore: ReturnType<AppStore['inspector']> }
    | { kind: 'deactivateAccount'; account: Account; restore: ReturnType<AppStore['inspector']> }
    | null
  >(null);
  /** Último tipo pedido: el texto no cambia mientras el diálogo se cierra. */
  private readonly confirmKind = signal<'reverse' | 'deactivateAccount'>('reverse');
  readonly confirmPrefix = computed(() => `workspace.confirm.${this.confirmKind()}`);
  async reverseMovement(movement: Movement) {
    try {
      await firstValueFrom(
        this.api.reverseMovement(movement.id, {
          date: new Date().toISOString().slice(0, 10),
          reason: 'Reversado desde la aplicación',
        }),
      );
      this.store.inspector.set(null);
      this.store.toast.set(this.i18n.t('workspace.messages.movementReversed'));
      await this.movementsBook.loadMovementPage(this.store.remoteMovementPage());
    } catch (error) {
      this.store.toast.set(
        error instanceof Error ? error.message : this.i18n.t('workspace.messages.movementReverseFailed'),
      );
    }
  }
  async shareSelected() {
    const movement = this.selectedMovement();
    const person = this.store.data().people.find((item) => item.name === movement?.person);
    if (!movement || !person) return;
    try {
      await firstValueFrom(
        this.api.createSharedPurchase({
          purchaseMovement: movement.id,
          shares: [{ counterparty: person.id, basis: 1, percent: { rate: '1' } }],
          description: movement.description,
        }),
      );
      this.store.toast.set(this.i18n.t('workspace.messages.sharedPurchase'));
    } catch (error) {
      this.store.toast.set(
        error instanceof Error ? error.message : this.i18n.t('workspace.messages.sharedPurchaseFailed'),
      );
    }
  }
  async issueSelectedSettlement() {
    const person = this.selectedPerson();
    if (!person) return;
    const today = new Date().toISOString().slice(0, 10);
    const start = `${today.slice(0, 7)}-01`;
    try {
      await firstValueFrom(
        this.api.issueSettlement({
          counterparty: person.id,
          period: { start, end: today },
          cutOff: today,
          currency: 'COP',
        }),
      );
      this.store.toast.set(this.i18n.t('workspace.messages.settlementIssued', { name: person.name }));
      void this.cargarHistorialDePersona(person.id);
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('workspace.messages.settlementFailed'));
    }
  }
  readonly personPurchases = signal<
    readonly { id: string; date: string; description: string; share: number; total: number }[] | null
  >(null);
  readonly personSettlements = signal<readonly ApiSettlement[] | null>(null);
  private readonly cargaDePersona = effect(() => {
    const person = this.store.inspector()?.type === 'person' ? this.selectedPerson() : undefined;
    untracked(() => void this.cargarHistorialDePersona(person?.id ?? null));
  });

  private async cargarHistorialDePersona(personId: string | null): Promise<void> {
    this.personPurchases.set(null);
    this.personSettlements.set(null);
    if (!personId || !this.features.enabled('people.history')) return;
    const [compras, liquidaciones] = await Promise.allSettled([
      this.can(P.personas.compras.listar) ? firstValueFrom(this.api.sharedPurchases()) : Promise.resolve(null),
      this.can(P.personas.liquidaciones.listar) ? firstValueFrom(this.api.settlements()) : Promise.resolve(null),
    ]);
    if (this.selectedPerson()?.id !== personId) return;
    if (compras.status === 'fulfilled' && compras.value)
      this.personPurchases.set(this.comprasDe(personId, compras.value));
    if (liquidaciones.status === 'fulfilled' && liquidaciones.value)
      this.personSettlements.set(
        liquidaciones.value
          .filter((settlement) => settlement.counterparty.id === personId)
          .slice()
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
      );
  }

  private comprasDe(personId: string, compras: readonly ApiSharedPurchase[]) {
    return compras
      .flatMap((compra) => {
        const parte = compra.allocation.shares.find((share) => share.share.counterparty.id === personId);
        return parte
          ? [
              {
                id: compra.id,
                date: compra.date,
                description: compra.description ?? compra.card.name,
                share: parseMoney(parte.amount),
                total: parseMoney(compra.total),
              },
            ]
          : [];
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  canEditSelectedAccount(): boolean {
    const account = this.selectedAccount();
    return !!account && this.can(permisoParaEditarCuenta(account.type));
  }
  editSelectedPerson(): void {
    const person = this.selectedPerson();
    if (person) this.store.form.set({ kind: 'person', targetId: person.id });
  }
  editSelectedInvestment(): void {
    const investment = this.selectedInvestment();
    if (investment) this.store.form.set({ kind: 'investment', targetId: investment.id });
  }
  /** Abre el mismo formulario de alta, precargado con la cuenta o tarjeta elegida. */
  editSelectedAccount(): void {
    const account = this.selectedAccount();
    if (!account) return;
    this.store.form.set({ kind: 'account', account });
  }
  async deactivateAccount(account: Account) {
    try {
      await firstValueFrom(
        this.api.updateAccount(account.id, {
          name: account.name,
          lastFour: account.lastFour ?? null,
          isDefault: false,
          isActive: false,
        }),
      );
      this.store.data.update((data) => ({ ...data, accounts: data.accounts.filter((item) => item.id !== account.id) }));
      this.store.inspector.set(null);
      this.store.toast.set(this.i18n.t('workspace.messages.accountDeactivated'));
    } catch (error) {
      this.store.toast.set(
        error instanceof Error ? error.message : this.i18n.t('workspace.messages.accountDeactivateFailed'),
      );
    }
  }
}
