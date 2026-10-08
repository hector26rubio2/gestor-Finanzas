import { computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiDashboard, FinanceApiClient } from '@core/api';
import { parseMoney, sumBy } from '@core/utils';
import { I18nService } from '@core/i18n';
import { AppStore, esGasto, montoDeGasto, montoDeIngreso, totalDeGastos, totalDeIngresos } from '@core/state';
import type { Movement } from '@core/state';
import { sincronizarConLaUrl } from '@core/routing/url-state';
import { UiOption } from '@ui/select';
import { crearHistoriaDeFlujo, crearMovimientosDelPeriodo } from '@shared/historia';
import { Dimension, Seleccion } from '@shared/tablero/dashboard.model';
import { DashboardPeriodo } from './periodo/dashboard-periodo';

export interface DatosDelTableroDeps {
  dimensionKey(movement: Movement, dimension: Dimension): { label: string };
  typeLabel(type: string): string;
  nadaQueMostrar(): boolean;
}

export class DatosDelTablero {
  private readonly store = inject(AppStore);
  private readonly api = inject(FinanceApiClient);
  private readonly i18n = inject(I18nService);
  private readonly periodo = inject(DashboardPeriodo);

  constructor(private readonly deps: DatosDelTableroDeps) {}

  readonly accountId = signal('all');
  readonly accountType = signal('all');
  readonly globalCategory = signal('all');
  readonly localCategory = signal('all');

  private readonly urlDelDashboard = [
    sincronizarConLaUrl('cuenta', this.accountId, 'all'),
    sincronizarConLaUrl('tipo', this.accountType, 'all', (v) => ['all', 'credit', 'savings', 'cash'].includes(v)),
    sincronizarConLaUrl('categoria', this.globalCategory, 'all'),
  ];
  readonly allCategories = computed(() =>
    [...new Set(this.store.categories().map((categoria) => categoria.name))].sort((a, b) => a.localeCompare(b)),
  );
  readonly accountOptions = computed(() =>
    this.store.data().accounts.filter((a) => this.accountType() === 'all' || a.type === this.accountType()),
  );
  readonly accountSelectOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('dashboard.filters.allAccounts') },
    ...this.accountOptions().map((account) => ({ value: account.id, label: account.name })),
  ]);
  readonly categorySelectOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('dashboard.filters.allCategories') },
    ...this.allCategories().map((category) => ({ value: category, label: category })),
  ]);
  readonly localCategoryOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('dashboard.filters.allLocal') },
    ...this.localOptions().map((category) => ({ value: category, label: category })),
  ]);
  readonly seleccion = signal<Seleccion | null>(null);
  private cumpleSeleccion(m: Movement, conFecha: boolean): boolean {
    const seleccion = this.seleccion();
    if (!seleccion) return true;
    if (seleccion.tipo === 'importe') {
      const valor = Math.abs(m.amount);
      return valor >= seleccion.min && valor <= seleccion.max;
    }
    if (seleccion.dimension === 'date' && !conFecha) return true;
    return this.deps.dimensionKey(m, seleccion.dimension).label === seleccion.label;
  }
  private seleccionSoloDeFecha(): boolean {
    const seleccion = this.seleccion();
    return !seleccion || (seleccion.tipo === 'dimension' && seleccion.dimension === 'date');
  }
  private coincideConFiltros(m: Movement): boolean {
    const cuenta = this.store.account(m.accountId);
    return (
      (this.accountId() === 'all' || m.accountId === this.accountId()) &&
      (this.accountType() === 'all' || cuenta?.type === this.accountType()) &&
      (this.globalCategory() === 'all' || m.category === this.globalCategory()) &&
      this.cumpleSeleccion(m, false)
    );
  }
  readonly historial = crearHistoriaDeFlujo(this.periodo.rangosHistoricos, {
    incluir: (m) => this.coincideConFiltros(m),
    usarServidor: () =>
      this.accountId() === 'all' &&
      this.accountType() === 'all' &&
      this.globalCategory() === 'all' &&
      this.seleccionSoloDeFecha(),
  });
  readonly remote = signal<ApiDashboard | null>(null);

  private readonly cargaRemota = effect(() => {
    const rango = this.periodo.range();
    if (this.deps.nadaQueMostrar()) return;
    void firstValueFrom(this.api.dashboard(rango.start, rango.end))
      .then((valor) => this.remote.set(valor))
      .catch(() => this.remote.set(null));
  });

  private readonly delPeriodo = crearMovimientosDelPeriodo(computed(() => this.periodo.range()));
  readonly cargandoPeriodo = this.delPeriodo.cargando;
  readonly base = computed(() =>
    this.delPeriodo.movimientos().filter((m) => {
      const a = this.store.account(m.accountId);
      return (
        m.date >= this.periodo.range().start &&
        m.date <= this.periodo.range().end &&
        (this.accountId() === 'all' || m.accountId === this.accountId()) &&
        (this.accountType() === 'all' || a?.type === this.accountType())
      );
    }),
  );
  readonly localOptions = computed(() =>
    [
      ...new Set(
        this.base()
          .filter(esGasto)
          .map((m) => m.category),
      ),
    ].sort(),
  );
  readonly movements = computed(() =>
    this.base().filter(
      (m) => (this.globalCategory() === 'all' || m.category === this.globalCategory()) && this.cumpleSeleccion(m, true),
    ),
  );
  readonly income = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.income);
    return totalDeIngresos(this.movements());
  });
  readonly expense = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.expense);
    return totalDeGastos(this.movements());
  });
  readonly net = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.net);
    return totalDeIngresos(this.movements()) - totalDeGastos(this.movements());
  });

  private readonly remoteAplicable = computed(() => {
    const sinFiltrosLocales =
      this.accountId() === 'all' && this.accountType() === 'all' && this.globalCategory() === 'all';
    const remoto = this.remote();
    return sinFiltrosLocales && remoto && remoto.period.period.start === this.periodo.range().start ? remoto : null;
  });
  readonly timeline = computed(() => {
    const remoto = this.remoteAplicable();
    const puntos = remoto
      ? remoto.series.map((punto) => ({
          date: punto.date,
          income: parseMoney(punto.income),
          expense: parseMoney(punto.expense),
        }))
      : this.movements().map((m) => ({
          date: m.date,
          income: montoDeIngreso(m),
          expense: montoDeGasto(m),
        }));
    const map = new Map<string, { key: string; label: string; income: number; expense: number }>();
    for (const m of puntos) {
      const d = new Date(`${m.date}T12:00:00Z`),
        key = this.periodo.scale() === 'year' ? m.date.slice(0, 7) : m.date,
        label =
          this.periodo.scale() === 'year'
            ? new Intl.DateTimeFormat(this.store.preferences().locale, { month: 'short', timeZone: 'UTC' }).format(d)
            : new Intl.DateTimeFormat(this.store.preferences().locale, {
                day: '2-digit',
                month: 'short',
                timeZone: 'UTC',
              }).format(d),
        p = map.get(key) ?? { key, label, income: 0, expense: 0 };
      p.income += m.income;
      p.expense += m.expense;
      map.set(key, p);
    }
    const values = [...map.values()].sort((a, b) => a.key.localeCompare(b.key)),
      max = Math.max(1, ...values.flatMap((v) => [v.income, v.expense]));
    return values.map((v) => ({ ...v, incomeP: (v.income / max) * 100, expenseP: (v.expense / max) * 100 }));
  });
  readonly categoryDistribution = computed(() => {
    const totals = new Map<string, number>();
    for (const m of this.movements())
      if (esGasto(m) && (this.localCategory() === 'all' || m.category === this.localCategory()))
        totals.set(m.category, (totals.get(m.category) ?? 0) + montoDeGasto(m));
    const total = sumBy([...totals.values()], (value) => value),
      colors = ['#4f46e5', '#e11d48', '#d97706', '#0ea5e9', '#0d9488', '#64748b'];
    return [...totals]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        percent: Math.round((value / Math.max(1, total)) * 100),
        color: colors[i % colors.length],
      }));
  });
  readonly accountDistribution = computed(() =>
    this.accountOptions()
      .map((a) => ({
        ...a,
        typeLabel: this.deps.typeLabel(a.type),
        amount: totalDeGastos(this.movements().filter((m) => m.accountId === a.id)),
      }))
      .filter((a) => a.amount > 0)
      .sort((a, b) => b.amount - a.amount),
  );

  readonly hasFilters = computed(
    () =>
      this.periodo.scale() !== 'month' ||
      this.periodo.anchor() !== this.periodo.anclaPorDefecto ||
      this.accountId() !== 'all' ||
      this.accountType() !== 'all' ||
      this.globalCategory() !== 'all' ||
      this.localCategory() !== 'all' ||
      this.seleccion() !== null,
  );
  changeAccountType(type: string): void {
    this.accountType.set(type);
    if (this.accountId() !== 'all' && !this.accountOptions().some((a) => a.id === this.accountId()))
      this.accountId.set('all');
  }
  alternarCategoria(nombre: string): void {
    this.globalCategory.set(this.globalCategory() === nombre ? 'all' : nombre);
  }
  alternarCuenta(id: string): void {
    this.accountId.set(this.accountId() === id ? 'all' : id);
  }
  readonly seleccionEtiqueta = computed(() => {
    const seleccion = this.seleccion();
    if (!seleccion) return '';
    if (seleccion.tipo === 'importe') return `${this.i18n.t('dashboard.selection.amount')}: ${seleccion.label}`;
    return `${this.i18n.t(`dashboard.dimension.${seleccion.dimension}`)}: ${seleccion.label}`;
  });
  promoteCategory(): void {
    this.globalCategory.set(this.localCategory());
    this.store.log(this.i18n.t('dashboard.log.filterApplied', { value: this.localCategory() }));
  }
  reset(): void {
    this.periodo.scale.set('month');
    this.periodo.anchor.set(this.periodo.anclaPorDefecto);
    this.accountId.set('all');
    this.accountType.set('all');
    this.globalCategory.set('all');
    this.localCategory.set('all');
    this.seleccion.set(null);
  }
}
