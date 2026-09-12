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

/*
 * Sin rotulo sobre el titulo. Un «LIBRO CENTRAL» en versales encima de «Movimientos» no
 * dice nada que el titulo no diga ya, y es el adorno mas repetido de las interfaces
 * generadas. La estructura tiene que codificar informacion, no decorarla.
 */
const labels: Record<string, { title: string; description: string }> = {
  movements: {
    title: 'Movimientos',
    description: 'Todos los efectos económicos, en un único lugar.',
  },
  calendar: {
    title: 'Calendario',
    description: 'Consulta operaciones y compromisos sin deformar el calendario.',
  },
  accounts: {
    title: 'Cuentas y tarjetas',
    description: 'Explora cuentas, tarjetas y sus movimientos relacionados.',
  },
  people: {
    title: 'Personas y deudas',
    description: 'Lo que debes y lo que te deben, sin compensaciones engañosas.',
  },
  portfolio: {
    title: 'Patrimonio e inversiones',
    description: 'Activos, pasivos y posiciones vinculadas a movimientos.',
  },
  planning: {
    title: 'Planificación',
    description: 'Compara alternativas sin modificar movimientos reales.',
  },
  reports: {
    title: 'Reportes',
    description: 'Entiende qué ocurrió y abre los movimientos que explican cada cifra.',
  },
  notifications: {
    title: 'Notificaciones',
    description: 'Revisa propuestas antes de convertirlas en movimientos.',
  },
  admin: {
    title: 'Administración',
    description: 'Miembros, capacidades y trazabilidad de la organización.',
  },
  settings: {
    title: 'Preferencias',
    description: 'Temas, tipografía, idioma y preferencias personales.',
  },
};

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
  readonly meta = computed(() => labels[this.page()] ?? labels['movements']);
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
    if (s?.type === 'movement') return 'Detalle del movimiento';
    if (s?.type === 'card') return this.selectedAccount()?.name ?? 'Detalle de tarjeta';
    if (s?.type === 'day')
      return (
        'Agenda del ' +
        new Intl.DateTimeFormat(this.store.preferences().locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
          new Date(`${s.id}T00:00:00Z`),
        )
      );
    if (s?.type === 'person') return this.selectedPerson()?.name ?? 'Persona';
    if (s?.type === 'investment') return this.selectedInvestment()?.name ?? 'Inversión';
    return 'Detalle de cuenta';
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
            : this.store.dayMoves(this.store.inspector()?.id ?? this.store.selectedCalendarDate()).length +
              ' operaciones';
  });
  readonly inspectorSubtitle = computed(
    () =>
      this.selectedMovement()?.description ??
      this.selectedAccount()?.name ??
      this.selectedPerson()?.name ??
      this.selectedInvestment()?.type ??
      'Información relacionada',
  );
  readonly inspectorFacts = computed(() => {
    const m = this.selectedMovement(),
      a = this.selectedAccount(),
      p = this.selectedPerson(),
      i = this.selectedInvestment();
    if (m)
      return [
        ['Fecha', m.date],
        ['Cuenta', this.store.account(m.accountId)?.name ?? '—'],
        ['Categoría', m.category],
        ['Naturaleza', m.amount < 0 ? 'Débito' : 'Crédito'],
        ['Estado', m.status],
        ['Responsabilidad', m.person ? `Prestado a/de ${m.person}` : 'Propia'],
        ['Cuotas', m.installmentTotal ? `${m.installmentCurrent} de ${m.installmentTotal}` : 'Una cuota'],
        ['Recurrencia', m.recurring ? (m.recurrence ?? 'Sí') : 'No recurrente'],
        [
          'Préstamo',
          m.loanRole === 'lent'
            ? 'Otorgado'
            : m.loanRole === 'borrowed'
              ? 'Recibido'
              : m.loanRole === 'repayment'
                ? 'Pago o devolución'
                : 'No aplica',
        ],
        ['Moneda original', m.originalCurrency === 'USD' ? `USD ${m.originalAmount} · TRM ${m.exchangeRate}` : 'COP'],
      ];
    if (a)
      return [
        ['Terminación', a.lastFour ? '•••• ' + a.lastFour : SIN_DATO],
        ['Moneda', a.currency],
        [
          'TRM de referencia',
          a.currency === 'USD' ? (a.exchangeRate?.toLocaleString('es-CO') ?? 'Sin definir') : 'No aplica',
        ],
        ['Corte', a.cutDay ? String(a.cutDay) : 'No aplica'],
        ['Pago', a.dueDay ? String(a.dueDay) : 'No aplica'],
        ['Límite', a.limit ? this.store.money(a.limit) : 'No aplica'],
      ];
    if (p)
      return [
        ['Me debe', this.store.money(p.owed)],
        ['Le debo', this.store.money(p.owing)],
        ['Saldo', this.store.money(p.owed - p.owing)],
      ];
    if (i)
      return [
        ['Tipo', i.type],
        ['Costo', this.store.money(i.cost)],
        ['Valor', this.store.money(i.value)],
        ['Variación', formatReturnRate(i.value, i.cost)],
      ];
    return [
      ['Fecha', this.store.inspector()?.id ?? this.store.selectedCalendarDate()],
      [
        'Operaciones',
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
      this.store.log('Movimiento reversado con trazabilidad');
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
      this.store.toast.set('Movimiento reversado; el original permanece en el historial.');
      await this.movementsBook.loadMovementPage(this.store.remoteMovementPage());
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo reversar el movimiento.');
    }
  }
  async shareSelected() {
    const movement = this.selectedMovement();
    const person = this.store.data().people.find((item) => item.name === movement?.person);
    if (!movement || !person) return;
    if (this.store.runtime.mode === 'demo') return this.store.log('Compra compartida registrada');
    try {
      await firstValueFrom(
        this.api.createSharedPurchase({
          purchaseMovement: movement.id,
          shares: [{ counterparty: person.id, basis: 1, percent: { rate: '1' } }],
          description: movement.description,
        }),
      );
      this.store.toast.set('Compra compartida registrada con trazabilidad.');
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo registrar el reparto.');
    }
  }
  async issueSelectedSettlement() {
    const person = this.selectedPerson();
    if (!person) return;
    if (this.store.runtime.mode === 'demo') return this.store.log('Liquidación generada');
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
      this.store.toast.set(`Liquidación generada para ${person.name}.`);
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo generar la liquidación.');
    }
  }
  async deactivateSelectedAccount() {
    const account = this.selectedAccount();
    if (!account || account.type === 'credit') return;
    if (this.store.runtime.mode === 'demo') {
      this.store.data.update((data) => ({ ...data, accounts: data.accounts.filter((item) => item.id !== account.id) }));
      this.store.inspector.set(null);
      this.store.log('Cuenta desactivada; el histórico se conserva');
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
      this.store.toast.set('Cuenta desactivada. Sus movimientos permanecen en el historial.');
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo desactivar la cuenta.');
    }
  }
  /** El boton vive en la cabecera compartida; la pestaña activa registra la logica real. */
  readAll(): void {
    this.headerActions.readAll()?.();
  }
}
