import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient, monthRange } from '@core/api';
import { UiOption } from '@ui/select';
import { P, toMovement } from '@core/session';
import { CAPABILITIES, AppStore } from '@core/state';
import { parseMoney } from '@core/utils';
import { TABLE_ALL_FIELDS, TableFilter } from '@ui/data-table';
import { I18nService } from '@core/i18n';
import type { Account } from '@core/state';

const ACCOUNT_TYPE_LABEL_KEYS: Record<Account['type'], string> = {
  savings: 'movements.filters.accountType.savings',
  checking: 'movements.filters.accountType.checking',
  cash: 'movements.filters.accountType.cash',
  wallet: 'movements.filters.accountType.wallet',
  other: 'movements.filters.accountType.other',
  credit: 'movements.filters.accountType.credit',
};

@Injectable({ providedIn: 'root' })
export class MovementsBookService {
  private readonly store = inject(AppStore);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly api = inject(FinanceApiClient);
  private readonly i18n = inject(I18nService);
  private can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  private movementRequest = 0;
  private readonly cursores = new Map<number, string>();

  readonly pinned = signal<readonly TableFilter[]>([]);
  readonly accountTypeOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('movements.filters.accountType.all') },
    ...Object.entries(ACCOUNT_TYPE_LABEL_KEYS).map(([value, key]) => ({
      value,
      label: this.i18n.t(key),
    })),
  ]);
  readonly movementColumns = computed(() => [
    { key: 'date', label: this.i18n.t('movements.column.date'), filter: 'date' as const, rawKey: 'dateIso' },
    { key: 'description', label: this.i18n.t('movements.column.description') },
    { key: 'amount', label: this.i18n.t('movements.column.amount') },
    {
      key: 'account',
      label: this.i18n.t('movements.column.account'),
      options: this.store.data().accounts.map((account) => account.name),
    },
    {
      key: 'effect',
      label: this.i18n.t('movements.column.effect'),
      essential: false,
      options: ['debit', 'credit', 'pending'].map((clave) => this.i18n.t(`movements.column.effect.${clave}`)),
    },
    { key: 'currency', label: this.i18n.t('movements.column.currency'), essential: false },
    { key: 'financing', label: this.i18n.t('movements.column.financing'), essential: false },
    { key: 'responsibility', label: this.i18n.t('movements.column.responsibility'), essential: false },
    { key: 'recurrence', label: this.i18n.t('movements.column.recurrence'), essential: false },
  ]);
  private valoresDe(...campos: string[]): string[] {
    return this.pinned()
      .filter((filtro) => campos.includes(filtro.field))
      .map((filtro) => filtro.value.trim())
      .filter(Boolean);
  }

  private rangoDe(valor: string): { start: string; end: string } | null {
    const iso = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(valor);
    const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor);
    if (local) {
      const dia = `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
      return { start: dia, end: dia };
    }
    if (!iso) return null;
    if (iso[3]) return { start: valor, end: valor };
    return monthRange(iso[2] ? `${iso[1]}-${iso[2]}` : iso[1]);
  }

  private filtroDelServidor(): Record<string, unknown> {
    const filtro: Record<string, unknown> = {};
    const textos = this.valoresDe(
      TABLE_ALL_FIELDS,
      'description',
      'currency',
      'financing',
      'responsibility',
      'recurrence',
    );
    if (textos.length) filtro['text'] = textos.join(' ');
    const importes = this.valoresDe('amount')
      .map((valor) => Number(valor.replace(/[^\d,]/g, '').replace(',', '.')))
      .filter((valor) => Number.isFinite(valor) && valor > 0);
    if (importes.length) {
      filtro['minAmountBase'] = String(Math.min(...importes));
      filtro['maxAmountBase'] = String(Math.max(...importes));
    }
    const rangos = this.valoresDe('date')
      .map((valor) => this.rangoDe(valor))
      .filter((rango) => rango !== null);
    if (rangos.length) {
      const periodo = this.store.period();
      const base = periodo === 'all' ? null : monthRange(periodo);
      const inicio = [base?.start ?? '', ...rangos.map((rango) => rango.start)].sort().at(-1)!;
      const fin = [base?.end ?? '9999-12-31', ...rangos.map((rango) => rango.end)].sort()[0];
      filtro['range'] = { start: inicio, end: fin };
    }
    const nombres = this.valoresDe('account').map((valor) => valor.toLocaleLowerCase());
    if (nombres.length) {
      const cuentas = this.store
        .data()
        .accounts.filter((cuenta) => nombres.some((nombre) => cuenta.name.toLocaleLowerCase().includes(nombre)));
      filtro['accounts'] = cuentas.filter((cuenta) => cuenta.type !== 'credit').map((cuenta) => cuenta.id);
      filtro['cards'] = cuentas.filter((cuenta) => cuenta.type === 'credit').map((cuenta) => cuenta.id);
      if (!cuentas.length) filtro['accounts'] = ['00000000-0000-0000-0000-000000000000'];
    }
    const debito = this.i18n.t('movements.column.effect.debit').toLocaleLowerCase();
    const flujos = this.valoresDe('effect').map((valor) => (debito.includes(valor.toLocaleLowerCase()) ? 2 : 1));
    if (flujos.length) filtro['flows'] = [...new Set(flujos)];
    return filtro;
  }
  readonly movementRows = computed(() =>
    this.store.movements().map((m) => ({
      id: m.id,
      date: this.formatDate(m.date),
      dateIso: m.date,
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
  formatDate(value: string): string {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(this.store.preferences().locale, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(parsed);
  }
  readonly movementsLoading = signal(false);
  private cuentaFiltrada() {
    const id = this.store.accountFilter();
    return id === 'all' ? null : (this.store.account(id) ?? { id, type: 'savings' as const });
  }

  private cursorPara(page: number): string | undefined {
    const siguiente = page === this.store.remoteMovementPage() + 1 ? this.store.remoteMovementCursor() : null;
    return this.cursores.get(page) ?? siguiente ?? undefined;
  }

  async loadMovementPage(page: number): Promise<void> {
    if (!this.can(P.movimientos.ver)) return;
    const request = ++this.movementRequest;
    this.movementsLoading.set(true);
    if (page === 1) this.cursores.clear();
    try {
      const period = this.store.period();
      const result = await firstValueFrom(
        this.api.movements({
          page,
          after: this.cursorPara(page),
          pageSize: this.store.remoteMovementSize(),
          search: this.store.query() || undefined,
          accountId: this.cuentaFiltrada()?.type === 'credit' ? undefined : this.cuentaFiltrada()?.id,
          period: period === 'all' ? undefined : period,
          filter:
            this.cuentaFiltrada()?.type === 'credit'
              ? { ...this.filtroDelServidor(), cards: [this.cuentaFiltrada()!.id] }
              : this.filtroDelServidor(),
        }),
      );
      if (request !== this.movementRequest) return;
      const catalogo = this.store.kindCatalog();
      this.store.data.update((data) => ({
        ...data,
        movements: result.items.map((item) => toMovement(this.i18n, catalogo, item)),
      }));
      if (result.nextCursor) this.cursores.set(page + 1, result.nextCursor);
      this.store.remoteMovementCursor.set(result.nextCursor ?? null);
      this.store.remoteMovementPage.set(page);
      this.store.movimientosListos.set(true);
      this.store.remoteMovementSize.set(result.size);
      if (result.total !== null) this.store.remoteMovementTotal.set(result.total);
      if (result.totals)
        this.store.remoteMovementTotals.set({
          income: parseMoney(result.totals.income),
          expense: parseMoney(result.totals.expense),
        });
      else if (page === 1) this.store.remoteMovementTotals.set(null);
    } catch (error) {
      if (request !== this.movementRequest) return;
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('movements.error.loadPage'));
    } finally {
      if (request === this.movementRequest) this.movementsLoading.set(false);
    }
  }
  async asegurarPrimeraPagina(): Promise<void> {
    if (!this.store.movimientosListos()) await this.loadMovementPage(1);
  }
  changeMovementPageSize(size: number): void {
    this.store.remoteMovementSize.set(size);
    void this.loadMovementPage(1);
  }
  inspectMovement(row: Record<string, unknown>): void {
    this.store.inspect('movement', String(row['id']));
  }
}
