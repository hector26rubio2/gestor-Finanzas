import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MovementsBookService } from '../shared/movements/movements-book.service';
import { HeaderActionsService } from '../shared/header-actions.service';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AccountFormComponent, ManagementFormComponent } from '../forms';
import { IconComponent } from '../ui/icon';
import { SinAccesoComponent } from '../ui/sin-acceso';
import { P } from '../core/permissions';
import { RemoteBootstrap } from '../core/remote-bootstrap';
import { CAPABILITIES, DemoStore } from '../core/store';
import { OverlayComponent } from '../ui/ui';
import { FinanceApiClient } from '../core/api-client';
import { firstValueFrom } from 'rxjs';
import { formatReturnRate } from '../core/money';
import { I18nService } from '../core/i18n';

/*
 * Sin rotulo sobre el titulo. Un «LIBRO CENTRAL» en versales encima de «Movimientos» no
 * dice nada que el titulo no diga ya, y es el adorno mas repetido de las interfaces
 * generadas. La estructura tiene que codificar informacion, no decorarla.
 */
const paginasConMeta = [
  'movements',
  'calendar',
  'accounts',
  'people',
  'portfolio',
  'planning',
  'reports',
  'notifications',
  'admin',
  'settings',
] as const;

/** Marca de dato ausente. Un campo que la API no publica se comunica, no se rellena. */
const SIN_DATO = '—';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    OverlayComponent,
    AccountFormComponent,
    ManagementFormComponent,
    SinAccesoComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class WorkspaceComponent {
  readonly Math = Math;
  readonly i18n = inject(I18nService);
  readonly store = inject(DemoStore);
  readonly movementsBook = inject(MovementsBookService);
  private readonly capabilities = inject(CAPABILITIES);
  readonly P = P;
  /**
   * Vistas cuyo contenido son bloques sueltos, cada uno con su permiso.
   *
   * Las demas se sostienen solas: llegar a Movimientos exige `movimientos.ver`, y ese
   * codigo ya trae la tabla. Estas dos no tienen nada equivalente —Reportes es un
   * conjunto de bloques y Planificacion un conjunto de simuladores—, asi que sin ninguno
   * concedido quedan en blanco.
   *
   * Antes hacia falta ademas un `X.listar` en las siete, y concederlo se olvidaba: la
   * entrada aparecia en el menu lateral y dentro no habia nada, sin decir por que.
   */
  private readonly bloquesPorVista: Readonly<Record<string, readonly string[]>> = {
    reports: [
      P.reportes.comparativo.ver,
      P.reportes.categorias.ver,
      P.reportes.tendencia.ver,
      P.reportes.deuda.ver,
      P.reportes.patrimonio.ver,
      P.reportes.hallazgos.ver,
      P.reportes.exportar,
    ],
    planning: [
      P.planificacion.deudas.ver,
      P.planificacion.compras.ver,
      P.planificacion.vacaciones.ver,
      P.planificacion.inversiones.ver,
    ],
  };

  /** La vista activa no tiene ni uno de sus bloques concedido. */
  readonly sinNingunBloque = computed(() => {
    const bloques = this.bloquesPorVista[this.page()];
    return !!bloques && !bloques.some((codigo) => this.can(codigo));
  });

  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  private route = inject(ActivatedRoute);
  private readonly arranque = inject(RemoteBootstrap);
  private api = inject(FinanceApiClient);
  readonly page = computed(() => this.route.snapshot.url[0]?.path ?? 'movements');
  readonly meta = computed(() => {
    const page = (paginasConMeta as readonly string[]).includes(this.page()) ? this.page() : 'movements';
    return {
      title: this.i18n.t(`workspace.labels.${page}.title`),
      description: this.i18n.t(`workspace.labels.${page}.description`),
    };
  });
  readonly cardPaymentAmount = signal(500000);
  readonly cardPurchases = computed(() => {
    const id = this.selectedAccount()?.id;
    return this.store
      .data()
      .movements.filter((m) => m.accountId === id && m.amount < 0 && m.kind === 'expense')
      .slice(0, 12);
  });
  readonly cardDebt = computed(() => {
    const account = this.selectedAccount();
    return account
      ? Math.max(0, -this.store.balance(account)) ||
          this.cardPurchases().reduce((sum, m) => sum + Math.abs(m.amount), 0)
      : 0;
  });
  readonly paymentAllocation = computed(() => {
    let remaining = Math.max(0, this.cardPaymentAmount());
    return this.cardPurchases().map((m) => {
      const before = Math.abs(m.amount);
      const applied = Math.min(before, remaining);
      remaining -= applied;
      return {
        id: m.id,
        description: m.description,
        installment: m.installmentTotal ? `${m.installmentCurrent}/${m.installmentTotal}` : '1/1',
        before,
        applied,
        after: before - applied,
      };
    });
  });
  readonly appliedPayment = computed(() => this.paymentAllocation().reduce((sum, row) => sum + row.applied, 0));
  readonly cardStatementPurchases = computed(() =>
    this.cardPurchases().reduce((sum, m) => sum + Math.abs(m.amount), 0),
  );
  readonly nextInstallments = computed(() =>
    this.cardPurchases().reduce((sum, m) => sum + Math.abs(m.amount) / Math.max(1, m.installmentTotal ?? 1), 0),
  );
  /**
   * Interes del proximo corte, con la tasa que declara la tarjeta.
   *
   * Antes aplicaba un 0.023 mensual fijo —un 27.6 % anual— a cualquier tarjeta, sin
   * mirar la suya: las de los datos demo declaran 10.2 % y 7.8 %, y la pantalla enseñaba
   * un numero que no salia de ninguna parte bajo el rotulo «Interes estimado». Inventar
   * una cifra en una pantalla de dinero es peor que no darla, porque quien la lee decide
   * con ella.
   *
   * Sin tasa declarada devuelve null y la linea no se pinta.
   */
  readonly cardEstimatedInterest = computed(() => {
    const anual = this.selectedAccount()?.annualRate;
    if (anual === undefined || anual === null || !Number.isFinite(anual)) return null;
    return Math.round(this.cardDebt() * (anual / 100 / 12));
  });
  readonly cardStatementTotal = computed(() =>
    Math.round(this.nextInstallments() + (this.cardEstimatedInterest() ?? 0)),
  );
  readonly months = [
    { value: '2026-08', label: 'Agosto 2026' },
    { value: '2026-07', label: 'Julio 2026' },
    { value: '2026-06', label: 'Junio 2026' },
    { value: '2026-05', label: 'Mayo 2026' },
  ];
  private readonly headerActions = inject(HeaderActionsService);
  /** El boton vive en la cabecera compartida; la pestaña activa registra la logica real. */
  exportReport(): void {
    this.headerActions.exportReport()?.();
  }
  exportMovements(): void {
    this.headerActions.exportMovements()?.();
  }

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
    const source = this.store.data().accounts.find((account) => account.type === 'savings');
    await this.store.save({
      kind: 'payment',
      date: new Date().toISOString().slice(0, 10),
      accountId: source?.id ?? '',
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
        [t('workspace.inspector.facts.nature'), m.amount < 0 ? t('workspace.inspector.facts.debit') : t('workspace.inspector.facts.credit')],
        [t('workspace.inspector.facts.status'), m.status],
        [
          t('workspace.inspector.facts.responsibility'),
          m.person ? t('workspace.inspector.facts.loanedTo', { person: m.person }) : t('workspace.inspector.facts.own'),
        ],
        [
          t('workspace.inspector.facts.installments'),
          m.installmentTotal
            ? t('workspace.inspector.facts.installmentsOf', { current: m.installmentCurrent ?? 1, total: m.installmentTotal })
            : t('workspace.inspector.facts.oneInstallment'),
        ],
        [
          t('workspace.inspector.facts.recurrence'),
          m.recurring ? (m.recurrence ?? t('workspace.inspector.facts.yes')) : t('workspace.inspector.facts.notRecurring'),
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
            ? t('workspace.inspector.facts.originalCurrencyValue', { amount: m.originalAmount ?? 0, rate: m.exchangeRate ?? 0 })
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
        [t('workspace.inspector.facts.cutoff'), a.cutDay ? String(a.cutDay) : t('workspace.inspector.facts.notApplicable')],
        [t('workspace.inspector.facts.dueDate'), a.dueDay ? String(a.dueDay) : t('workspace.inspector.facts.notApplicable')],
        [t('workspace.inspector.facts.limit'), a.limit ? this.store.money(a.limit) : t('workspace.inspector.facts.notApplicable')],
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
  async reverseSelected() {
    const movement = this.selectedMovement();
    if (!movement) return;
    if (this.store.runtime.mode === 'demo') {
      this.store.data.update((data) => ({
        ...data,
        movements: data.movements.filter((item) => item.id !== movement.id),
      }));
      this.store.inspector.set(null);
      this.store.log(this.i18n.t('workspace.messages.movementReversedLocal'));
      return;
    }
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
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('workspace.messages.movementReverseFailed'));
    }
  }
  async shareSelected() {
    const movement = this.selectedMovement();
    const person = this.store.data().people.find((item) => item.name === movement?.person);
    if (!movement || !person) return;
    if (this.store.runtime.mode === 'demo') return this.store.log(this.i18n.t('workspace.messages.sharedPurchaseLocal'));
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
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('workspace.messages.sharedPurchaseFailed'));
    }
  }
  async issueSelectedSettlement() {
    const person = this.selectedPerson();
    if (!person) return;
    if (this.store.runtime.mode === 'demo') return this.store.log(this.i18n.t('workspace.messages.settlementLocal'));
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
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('workspace.messages.settlementFailed'));
    }
  }
  async deactivateSelectedAccount() {
    const account = this.selectedAccount();
    if (!account || account.type === 'credit') return;
    if (this.store.runtime.mode === 'demo') {
      this.store.data.update((data) => ({ ...data, accounts: data.accounts.filter((item) => item.id !== account.id) }));
      this.store.inspector.set(null);
      this.store.log(this.i18n.t('workspace.messages.accountDeactivatedLocal'));
      return;
    }
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
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('workspace.messages.accountDeactivateFailed'));
    }
  }
  /** El boton vive en la cabecera compartida; la pestaña activa registra la logica real. */
  readAll(): void {
    this.headerActions.readAll()?.();
  }
}
