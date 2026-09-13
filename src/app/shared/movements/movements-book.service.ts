import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiMovement, FinanceApiClient } from '../../core/api-client';
import { UiOption } from '../../ui/select';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { parseMoney } from '../../core/money';
import { signOf } from '../../core/movement-kinds';
import { I18nService } from '../../core/i18n';

/**
 * Movimientos ya filtrados y con formato de fila, mas su paginacion remota.
 *
 * Lo comparten Movimientos (que expone los controles de filtro) y Cuentas (cuya tabla de
 * movimientos de una cuenta filtra sobre el mismo resultado, heredando sin proponerselo
 * los filtros de tipo/categoria/operacion de Movimientos: asi se comportaba antes de
 * dividir la pagina y no es este el momento de cambiarlo). El inspector de un movimiento
 * tambien necesita recargar la pagina tras reversar uno.
 */
@Injectable({ providedIn: 'root' })
export class MovementsBookService {
  private readonly store = inject(DemoStore);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly api = inject(FinanceApiClient);
  private readonly i18n = inject(I18nService);
  private can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  private movementRequest = 0;

  readonly movementAccountType = signal<'all' | 'savings' | 'credit' | 'cash'>('all');
  readonly movementCategory = signal('all');
  readonly movementOperation = signal('all');
  readonly movementCategories = computed(() =>
    [...new Set(this.store.data().movements.map((m) => m.category))].sort(),
  );
  readonly accountTypeOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('movements.filters.accountType.all') },
    { value: 'savings', label: this.i18n.t('movements.filters.accountType.savings') },
    { value: 'credit', label: this.i18n.t('movements.filters.accountType.credit') },
    { value: 'cash', label: this.i18n.t('movements.filters.accountType.cash') },
  ]);
  /**
   * `essential: false` manda la columna al detalle plegable de la fila en movil (ver
   * TableColumn.essential): con 9 columnas, sin esto cada fila se volvia una tarjeta de
   * medio celular y una pagina completa un scroll de miles de pixeles. Fecha, descripcion,
   * importe y cuenta son lo que se necesita para reconocer un movimiento de un vistazo; el
   * resto queda a un toque de distancia.
   */
  readonly movementColumns = computed(() => [
    { key: 'date', label: this.i18n.t('movements.column.date') },
    { key: 'description', label: this.i18n.t('movements.column.description') },
    { key: 'amount', label: this.i18n.t('movements.column.amount') },
    { key: 'account', label: this.i18n.t('movements.column.account') },
    { key: 'effect', label: this.i18n.t('movements.column.effect'), essential: false },
    { key: 'currency', label: this.i18n.t('movements.column.currency'), essential: false },
    { key: 'financing', label: this.i18n.t('movements.column.financing'), essential: false },
    { key: 'responsibility', label: this.i18n.t('movements.column.responsibility'), essential: false },
    { key: 'recurrence', label: this.i18n.t('movements.column.recurrence'), essential: false },
  ]);
  readonly filteredMovementData = computed(() =>
    this.store.movements().filter((m) => {
      const account = this.store.account(m.accountId);
      const accountType = this.movementAccountType();
      const category = this.movementCategory();
      const operation = this.movementOperation();
      return (
        (accountType === 'all' || account?.type === accountType) &&
        (category === 'all' || m.category === category) &&
        (operation === 'all' ||
          operation === m.kind ||
          (operation === 'loan' && !!m.loanRole) ||
          (operation === 'recurring' && !!m.recurring))
      );
    }),
  );
  readonly movementRows = computed(() =>
    this.filteredMovementData().map((m) => ({
      id: m.id,
      date: this.formatDate(m.date),
      description: m.description,
      account: this.store.account(m.accountId)?.name,
      effect:
        m.status === 'pending'
          ? this.i18n.t('movements.column.effect.pending')
          : m.amount < 0
            ? this.i18n.t('movements.column.effect.debit')
            : this.i18n.t('movements.column.effect.credit'),
      financing: m.installmentTotal
        ? this.i18n.t('movements.column.financing.installment', {
            current: m.installmentCurrent ?? 0,
            total: m.installmentTotal,
          })
        : m.loanRole === 'lent'
          ? this.i18n.t('movements.column.financing.loanGiven')
          : m.loanRole === 'borrowed'
            ? this.i18n.t('movements.column.financing.loanReceived')
            : m.loanRole === 'repayment'
              ? this.i18n.t('movements.column.financing.loanRepayment')
              : this.i18n.t('movements.column.financing.singleInstallment'),
      responsibility: m.person
        ? this.i18n.t('movements.column.responsibility.loaned', { person: m.person })
        : this.i18n.t('movements.column.responsibility.own'),
      recurrence: m.recurring
        ? m.recurrence === 'weekly'
          ? this.i18n.t('movements.column.recurrence.weekly')
          : m.recurrence === 'yearly'
            ? this.i18n.t('movements.column.recurrence.yearly')
            : this.i18n.t('movements.column.recurrence.monthly')
        : this.i18n.t('movements.column.recurrence.none'),
      currency:
        m.originalCurrency === 'USD'
          ? this.i18n.t('movements.column.currency.usdRate', {
              amount: m.originalAmount?.toLocaleString('en-US') ?? '',
              rate: m.exchangeRate?.toLocaleString('es-CO') ?? '',
            })
          : (this.store.account(m.accountId)?.currency ?? 'COP'),
      amount: this.store.money(m.amount),
      raw: m,
    })),
  );
  /** Una sola forma de escribir una fecha en toda la aplicacion, con el idioma de las preferencias. */
  formatDate(value: string): string {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(this.store.preferences().locale, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(parsed);
  }
  async loadMovementPage(page: number): Promise<void> {
    // Sin el permiso no se pide: el servidor responderia 403 y el aviso hablaria de un
    // fallo al cargar la pagina, que no es lo que pasa.
    if (this.store.runtime.mode !== 'api' || !this.can(P.movimientos.ver)) return;
    const request = ++this.movementRequest;
    try {
      const period = this.store.period();
      const result = await firstValueFrom(
        this.api.movements({
          page,
          pageSize: this.store.remoteMovementSize(),
          search: this.store.query() || undefined,
          accountId: this.store.accountFilter() === 'all' ? undefined : this.store.accountFilter(),
          period: period === 'all' ? undefined : period,
        }),
      );
      if (request !== this.movementRequest) return;
      this.store.data.update((data) => ({
        ...data,
        movements: result.items.map((item) => this.toRemoteMovement(item)),
      }));
      this.store.remoteMovementPage.set(result.page);
      this.store.remoteMovementSize.set(result.size);
      this.store.remoteMovementTotal.set(result.total);
    } catch (error) {
      if (request !== this.movementRequest) return;
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo cargar la página solicitada.');
    }
  }
  changeMovementPageSize(size: number): void {
    this.store.remoteMovementSize.set(size);
    void this.loadMovementPage(1);
  }
  private toRemoteMovement(source: ApiMovement): import('../../core/demo-data').Movement {
    // Misma tabla de invariantes que usa el arranque remoto: aquí estaba
    // duplicada la expresión de signo y la lista de clases escrita a mano.
    return {
      id: source.id,
      date: source.date,
      description: source.description ?? this.i18n.t('movements.fallback.noDescription'),
      accountId: source.links['account'] ?? source.links['card'] ?? '',
      category: source.linkNames['category']?.name ?? this.i18n.t('movements.fallback.noCategory'),
      kind: this.store.kindCatalog().family(source.kind, source.effect, source.flow),
      amount: parseMoney(source.amount.base) * signOf(source.flow, source.effect),
      status: 'confirmed',
      person: source.linkNames['counterparty']?.name,
      ownership: source.links['counterparty'] ? 'loaned' : 'own',
      recurring: Boolean(source.links['recurrence']),
    };
  }
  inspectMovement(row: Record<string, unknown>): void {
    this.store.inspect('movement', String(row['id']));
  }
}
