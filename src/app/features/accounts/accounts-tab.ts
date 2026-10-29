import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiWritesBus, FinanceApiClient } from '@core/api';
import type { Movement } from '@core/state';
import { traerMovimientosDeTarjetas } from '@shared/tarjetas';
import { filtrarCuentas } from './filtrar-cuentas';
import { construirVisual, crearEntorno } from '@shared/graficas';
import { deudaPendienteComoMovimientos } from './deuda-por-categoria';

const CUENTAS_EN_COLUMNAS = 6;
import { FormsModule } from '@angular/forms';
import { CarruselComponent } from '@ui/carrusel';
import { DataTableComponent } from '@ui/data-table';
import { KpiComponent } from '@ui/kpi';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { KpiGridComponent } from '@ui/kpi-grid';
import { SearchFieldComponent } from '@ui/search-field';
import { SegmentedComponent } from '@ui/segmented';
import { TableZoneComponent } from '@ui/table-zone';
import { TAB_PAGE_HOST_CLASS } from '@shared/tab-page-layout';
import { UiSelectComponent } from '@ui/select';
import { AppStore, CAPABILITIES, Account } from '@core/state';
import { I18nService } from '@core/i18n';
import { MovementsBookService } from '@shared/movements';
import { compactMoney } from '@shared/utils';
import { ChartCardComponent, ChartThemeService, barrasAgrupadas, barrasHorizontales } from '@ui/chart';
import {
  HEALTHY_UTILIZATION_PERCENT,
  creditCards,
  mostOverextendedCard,
  mostUsedCard,
  nextCardDue,
} from './card-insights';
import {
  PERIODOS_DE_HISTORIA,
  crearHistoriaDeSaldos,
  rangosMensuales,
  variacion,
  crearMovimientosDelPeriodo,
} from '@shared/historia';
import { estadoDe } from '@shared/tablero/kpi-ranges';
import { HlmButton } from '@spartan-ng/helm/button';
import { P } from '@core/session';
import { addDaysToIso } from '@core/utils';

@Component({
  selector: 'app-accounts-tab',
  imports: [
    CarruselComponent,
    ChartCardComponent,
    FormsModule,
    HlmToggleGroupImports,
    DataTableComponent,
    HlmButton,
    KpiComponent,
    KpiGridComponent,
    SearchFieldComponent,
    SegmentedComponent,
    TableZoneComponent,
    UiSelectComponent,
  ],
  templateUrl: './accounts-tab.html',
  host: { class: `${TAB_PAGE_HOST_CLASS} overflow-y-auto` },
})
export class AccountsTabComponent implements OnDestroy {
  readonly Math = Math;
  readonly store = inject(AppStore);
  readonly book = inject(MovementsBookService);
  readonly i18n = inject(I18nService);
  private readonly capabilities = inject(CAPABILITIES);

  private readonly referenceDate = computed(() => this.store.hoy());
  private readonly cards = computed(() => creditCards(this.store.data().accounts));
  private readonly debtOf = (card: Account) => Math.max(0, -this.store.balance(card));
  readonly nextDue = computed(() => nextCardDue(this.cards(), this.debtOf, this.referenceDate()));
  private readonly ultimos30 = crearMovimientosDelPeriodo(
    computed(() => ({ start: addDaysToIso(this.store.hoy(), -30), end: this.store.hoy() })),
  );
  readonly mostUsed = computed(() => mostUsedCard(this.cards(), this.ultimos30.movimientos(), this.referenceDate()));
  readonly mostOverextended = computed(() => mostOverextendedCard(this.cards(), this.debtOf));
  readonly healthyPercent = HEALTHY_UTILIZATION_PERCENT;
  private readonly historia = crearHistoriaDeSaldos(
    computed(() => rangosMensuales(PERIODOS_DE_HISTORIA, this.store.hoy())),
  );
  readonly historiaEtiqueta = computed(() => this.i18n.t('kpi.history.month', { count: PERIODOS_DE_HISTORIA }));
  readonly variacion = variacion;
  readonly availableSeries = computed(() => this.historia().map((punto) => punto.available));
  readonly debtSeries = computed(() => this.historia().map((punto) => punto.debt));
  readonly overextendedStatus = computed(() => {
    const over = this.mostOverextended();
    return over ? estadoDe(over.percent, { warnAt: 30, badAt: this.healthyPercent + 20, higherIsWorse: true }) : null;
  });
  private readonly temaGrafica = inject(ChartThemeService);
  private readonly dinero = (valor: number) => this.store.money(valor);
  private readonly compacto = (valor: number) => compactMoney(valor, this.store.preferences().locale);
  private readonly cuentasDeSaldo = computed(() =>
    this.store.data().accounts.filter((account) => account.type !== 'credit'),
  );
  readonly balancesOption = computed(() => {
    const palette = this.temaGrafica.palette();
    const cuentas = [...this.cuentasDeSaldo()]
      .map((account) => ({ nombre: account.name, saldo: this.store.balance(account) }))
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 8);
    const barras = cuentas.length <= CUENTAS_EN_COLUMNAS ? barrasAgrupadas : barrasHorizontales;
    return barras(
      palette,
      cuentas.map((cuenta) => cuenta.nombre),
      [
        {
          nombre: this.i18n.t('accounts.chart.balance'),
          valores: cuentas.map((cuenta) => cuenta.saldo),
          color: palette.accent,
        },
      ],
      this.dinero,
      this.compacto,
    );
  });
  readonly cuentasConDatos = computed(() => this.cuentasDeSaldo().length > 0);
  private readonly api = inject(FinanceApiClient);
  private readonly escrituras = inject(ApiWritesBus);
  private readonly movimientosDeTarjetas = signal<readonly Movement[]>([]);
  private peticionDeTarjetas = 0;
  private readonly traerMovimientosDeTarjetas = effect(() => {
    const ids = this.cards().map((card) => card.id);
    this.escrituras.version();
    const catalogo = this.store.kindCatalog();
    untracked(() => {
      const peticion = ++this.peticionDeTarjetas;
      const esVigente = () => peticion === this.peticionDeTarjetas;
      void traerMovimientosDeTarjetas(this.api, this.i18n, catalogo, ids)
        .then((movimientos) => {
          if (esVigente()) this.movimientosDeTarjetas.set(movimientos);
        })
        .catch(() => {
          if (!esVigente()) return;
          this.movimientosDeTarjetas.set([]);
          this.store.toast.set(this.i18n.t('accounts.cards.loadError'));
        });
    });
  });
  private readonly deudaPendiente = computed(() =>
    deudaPendienteComoMovimientos(this.cards(), this.movimientosDeTarjetas()),
  );
  readonly vistaDeFlujo = signal<'spend' | 'debt'>('spend');
  readonly opcionesDeFlujo = computed(() => [
    { value: 'spend', label: this.i18n.t('accounts.chart.flow.spend') },
    { value: 'debt', label: this.i18n.t('accounts.chart.flow.debt') },
  ]);
  elegirVistaDeFlujo(valor: string): void {
    this.vistaDeFlujo.set(valor === 'debt' ? 'debt' : 'spend');
  }
  private readonly movimientosDelFlujo = computed(() =>
    this.vistaDeFlujo() === 'debt' ? this.deudaPendiente() : this.ultimos30.movimientos(),
  );
  readonly flujoConDatos = computed(() =>
    this.movimientosDelFlujo().some((movimiento) => movimiento.kind === 'expense' && movimiento.amount < 0),
  );
  readonly flujoTitulo = computed(() =>
    this.i18n.t(this.vistaDeFlujo() === 'debt' ? 'accounts.chart.cardsTitle' : 'accounts.chart.spendTitle'),
  );
  readonly flujoVacio = computed(() =>
    this.i18n.t(this.vistaDeFlujo() === 'debt' ? 'accounts.chart.noDebt' : 'accounts.chart.noSpend'),
  );
  readonly flujoOption = computed(() =>
    construirVisual({
      config: { tipo: 'sankey', dimension: 'account', dimension2: 'category', measure: 'expense' },
      movs: this.movimientosDelFlujo(),
      entorno: crearEntorno(this.store, this.i18n, this.temaGrafica.palette(), 'month', this.flujoTitulo()),
    }),
  );

  readonly accountQuery = signal('');
  readonly accountType = signal<'all' | Account['type']>('all');
  readonly filteredAccounts = computed(() =>
    filtrarCuentas(
      this.store.data().accounts,
      this.accountQuery(),
      this.accountType(),
      this.store.preferences().locale,
    ),
  );
  readonly selectedAccountFilter = computed(() => this.store.accountFilter());
  readonly cuentaSeleccionada = computed(() => {
    const id = this.store.accountFilter();
    return id === 'all' ? null : (this.store.account(id) ?? null);
  });
  readonly puedePagar = computed(() => this.capabilities.allows(P.movimientos.pagos.crear));
  deudaDe(cuenta: Account): number {
    return this.debtOf(cuenta);
  }
  registrarAbono(id: string): void {
    this.store.inspect('card', id);
    this.store.cardPaymentMode.set(true);
  }

  setAccountQuery(value: string): void {
    this.accountQuery.set(value);
  }
  setAccountType(value: 'all' | Account['type']): void {
    this.accountType.set(value);
  }
  filterByAccount(id: string): void {
    this.store.accountFilter.set(id);
    void this.book.loadMovementPage(1);
  }
  selectAccount(id: string, type: string): void {
    this.filterByAccount(id);
    this.store.cardPaymentMode.set(false);
    this.store.inspect(type === 'credit' ? 'card' : 'account', id);
  }

  ngOnDestroy(): void {
    if (this.store.accountFilter() === 'all' && !this.book.pinned().length) return;
    this.store.accountFilter.set('all');
    this.book.pinned.set([]);
    void this.book.loadMovementPage(1);
  }
}
