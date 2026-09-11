import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiDashboard, FinanceApiClient } from '../core/api-client';
import { parseMoney, sumBy } from '../core/money';
import { P } from '../core/permissions';
import { sincronizarConLaUrl } from '../core/url-state';
import { CAPABILITIES, DemoStore } from '../core/store';
import { IconComponent } from '../ui/icon';
import { DataTableComponent, KpiComponent, OverlayComponent } from '../ui/ui';
import { UiOption, UiSelectComponent } from '../ui/select';

type Scale = 'day' | 'week' | 'month' | 'year';
type WidgetType = 'flow' | 'trend' | 'categories' | 'accounts' | 'scatter' | 'donut' | 'stacked' | 'heatmap';
type Widget = { id: string; title: string; kicker: string; type: WidgetType; wide: boolean; capability?: string };

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    KpiComponent,
    DataTableComponent,
    OverlayComponent,
    IconComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="dashboard">
    <header class="hero">
      <div>
        <h1>Hola, {{ store.user()?.name?.split(' ')?.[0] }}</h1>
        <p>Explora tus finanzas: cada filtro actualiza toda la visual.</p>
      </div>
      @if (puedePersonalizar()) {
        <button type="button" [attr.aria-pressed]="customizing()" (click)="customizing.update((v) => !v)">
          {{ customizing() ? 'Terminar' : 'Personalizar' }}
        </button>
      }
    </header>
    @if (nadaQueMostrar()) {
      <!--
        Llegar hasta aqui sin ninguna pieza concedida es raro, pero posible: quien
        administra puede haber dejado el acceso al panel y haber quitado los cuatro KPI,
        los widgets y la tabla. Una pantalla vacia sin explicacion se lee como averiada.
      -->
      <section class="sin-acceso" role="status">
        <h2>Tu acceso al panel no incluye ninguna de sus piezas</h2>
        <p>
          Puedes entrar, pero no se te ha concedido ningún indicador, gráfica ni la tabla del periodo. Pídele a quien
          administra tu espacio las piezas que necesites.
        </p>
      </section>
    } @else {
      <section class="filter-panel" aria-labelledby="filters-title">
        <header>
          <div>
            <h2 id="filters-title">Vista general</h2>
          </div>
          <button class="quiet" type="button" (click)="reset()" [disabled]="!hasFilters()">Limpiar filtros</button>
        </header>
        <div class="filters">
          <fieldset>
            <legend>Periodo</legend>
            @for (item of scales; track item.value) {
              <button
                type="button"
                [class.active]="scale() === item.value"
                [attr.aria-pressed]="scale() === item.value"
                (click)="scale.set(item.value)"
              >
                {{ item.label }}
              </button>
            }
          </fieldset>
          <div class="period-nav" aria-label="Navegar periodo">
            <span>Periodo activo</span>
            <div>
              <button type="button" aria-label="Periodo anterior" (click)="shiftPeriod(-1)">‹</button
              ><b>{{ periodShortLabel() }}</b
              ><button type="button" aria-label="Periodo siguiente" (click)="shiftPeriod(1)">›</button>
            </div>
          </div>
          <label
            >Cuenta<demo-select
              [ngModel]="accountId()"
              (ngModelChange)="accountId.set($event)"
              [options]="accountSelectOptions()"
              ariaLabel="Filtrar por cuenta"
          /></label>
          <label
            >Tipo de cuenta o tarjeta<demo-select
              [ngModel]="accountType()"
              (ngModelChange)="changeAccountType($event)"
              [options]="accountTypeOptions"
              ariaLabel="Filtrar por tipo de cuenta"
          /></label>
          <label
            >Categoría global<demo-select
              [ngModel]="globalCategory()"
              (ngModelChange)="globalCategory.set($event)"
              [options]="categorySelectOptions()"
              ariaLabel="Filtrar por categoría"
          /></label>
        </div>
        <p class="summary" role="status">{{ periodLabel() }} · {{ movements().length }} movimientos</p>
      </section>
    }
    @if (algunKpi()) {
      <section class="kpis" aria-label="Indicadores filtrados">
        @if (caps.allows(P.dashboard.kpi.balance)) {
          <demo-kpi label="Balance del periodo" [value]="store.money(net())" [hint]="periodLabel()" />
        }
        @if (caps.allows(P.dashboard.kpi.ingresos)) {
          <demo-kpi label="Ingresos" [value]="store.money(income())" hint="Según filtros activos" />
        }
        @if (caps.allows(P.dashboard.kpi.gastos)) {
          <demo-kpi label="Gastos" [value]="store.money(expense())" hint="Según filtros activos" />
        }
        @if (caps.allows(P.dashboard.kpi.recuento)) {
          <demo-kpi label="Movimientos" [value]="movements().length.toLocaleString()" hint="Registros visibles" />
        }
      </section>
    }
    <section class="grid">
      @for (widget of widgets(); track widget.id) {
        <article class="widget" [class.wide]="widget.wide">
          <header>
            <div>
              <span>{{ widget.kicker }}</span>
              <h2>{{ widget.title }}</h2>
            </div>
            @if (customizing()) {
              <div class="widget-actions">
                @if (caps.allows(P.dashboard.widget.orden.editar)) {
                  <button class="quiet" type="button" aria-label="Mover arriba" (click)="move(widget.id, -1)">
                    <demo-icon name="chevronUp" />
                  </button>
                  <button class="quiet" type="button" aria-label="Mover abajo" (click)="move(widget.id, 1)">
                    <demo-icon name="chevronDown" />
                  </button>
                }
                @if (caps.allows(P.dashboard.widget.tipo.editar)) {
                  <demo-select
                    aria-label="Tipo de visualización"
                    [ngModel]="widget.type"
                    [options]="widgetTypeOptions"
                    (ngModelChange)="changeType(widget.id, $event)"
                  />
                }
                @if (caps.allows(P.dashboard.widget.deshabilitar)) {
                  <button class="quiet" type="button" (click)="hide(widget.id)">Ocultar</button>
                }
              </div>
            }
          </header>
          @switch (widget.type) {
            @case ('flow') {
              <div class="legend">
                <span><i class="inc"></i>Ingresos</span><span><i class="exp"></i>Gastos</span>
              </div>
              <div class="line-visual" aria-label="Evolución de ingresos y gastos por intervalo">
                @if (timeline().length) {
                  <svg viewBox="0 0 1000 240" preserveAspectRatio="none" role="img">
                    <defs>
                      <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="var(--accent)" stop-opacity=".28" />
                        <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
                      </linearGradient>
                      <linearGradient id="expenseArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="var(--danger)" stop-opacity=".2" />
                        <stop offset="1" stop-color="var(--danger)" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <path class="area income-area" [attr.d]="areaPath('income')" />
                    <path class="area expense-area" [attr.d]="areaPath('expense')" />
                    <polyline
                      class="income-line"
                      vector-effect="non-scaling-stroke"
                      [attr.points]="linePoints('income')"
                    />
                    <polyline
                      class="expense-line"
                      vector-effect="non-scaling-stroke"
                      [attr.points]="linePoints('expense')"
                    />
                  </svg>
                  <div class="line-labels">
                    @for (point of timeline(); track point.key) {
                      <small>{{ point.label }}</small>
                    }
                  </div>
                } @else {
                  <p class="empty">No hay datos para estos filtros.</p>
                }
              </div>
            }
            @case ('categories') {
              <div class="local">
                <label
                  >Explorar categoría<demo-select
                    [ngModel]="localCategory()"
                    (ngModelChange)="localCategory.set($event)"
                    [options]="localCategoryOptions()"
                    ariaLabel="Explorar categoría" /></label
                ><button
                  type="button"
                  (click)="promoteCategory()"
                  [disabled]="localCategory() === 'all' || localCategory() === globalCategory()"
                >
                  Aplicar a todo
                </button>
              </div>
              <div class="category-list" aria-label="Distribución de gastos por categoría">
                @for (category of categoryDistribution(); track category.name) {
                  <button
                    type="button"
                    (click)="localCategory.set(category.name)"
                    [class.selected]="localCategory() === category.name"
                  >
                    <span><i [style.background]="category.color"></i>{{ category.name }}</span
                    ><b>{{ store.money(category.value) }}</b
                    ><small>{{ category.percent }} %</small
                    ><em><i [style.width.%]="category.percent" [style.background]="category.color"></i></em>
                  </button>
                } @empty {
                  <p class="empty">No hay gastos en esta selección.</p>
                }
              </div>
            }
            @case ('accounts') {
              <div class="account-list">
                @for (item of accountDistribution(); track item.id) {
                  <button type="button" (click)="accountId.set(item.id)" [class.selected]="accountId() === item.id">
                    <i [style.background]="item.color"></i
                    ><span
                      >{{ item.name }}<small>{{ typeLabel(item.type) }}</small></span
                    ><b>{{ store.money(item.amount, item.currency) }}</b>
                  </button>
                } @empty {
                  <p class="empty">No hay cuentas con movimientos.</p>
                }
              </div>
            }
            @case ('trend') {
              <div class="line-visual single" aria-label="Tendencia de gasto">
                @if (timeline().length) {
                  <svg viewBox="0 0 1000 240" preserveAspectRatio="none" role="img">
                    <defs>
                      <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="var(--accent)" stop-opacity=".3" />
                        <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <path class="area trend-area" [attr.d]="areaPath('expense')" />
                    <polyline class="income-line" [attr.points]="linePoints('expense')" />
                  </svg>
                  <div class="line-labels">
                    @for (point of timeline(); track point.key) {
                      <small>{{ point.label }}</small>
                    }
                  </div>
                } @else {
                  <p class="empty">No hay datos para mostrar.</p>
                }
              </div>
            }
            @case ('scatter') {
              <div class="scatter" role="img" aria-label="Relación entre importe y día del periodo">
                <span class="axis-title y">Importe</span><span class="axis-title x">Día del periodo</span>
                @for (point of scatterPoints(); track point.id) {
                  <i
                    [style.left.%]="point.x"
                    [style.bottom.%]="point.y"
                    [style.width.px]="point.size"
                    [style.height.px]="point.size"
                    [title]="point.label"
                  ></i>
                }
              </div>
            }
            @case ('donut') {
              <div class="donut-layout">
                <div class="donut-chart" [style.background]="donutGradient()">
                  <span
                    ><b>{{ store.money(expense()) }}</b
                    ><small>Gasto total</small></span
                  >
                </div>
                <div class="donut-legend">
                  @for (category of categoryDistribution().slice(0, 6); track category.name) {
                    <button (click)="localCategory.set(category.name)">
                      <i [style.background]="category.color"></i><span>{{ category.name }}</span
                      ><b>{{ category.percent }}%</b>
                    </button>
                  }
                </div>
              </div>
            }
            @case ('stacked') {
              <div class="stacked" aria-label="Composición de ingresos y gastos por periodo">
                @for (point of timeline(); track point.key) {
                  <div [title]="point.label">
                    <span class="stack-income" [style.flex-grow]="point.income || 1"></span
                    ><span class="stack-expense" [style.flex-grow]="point.expense || 1"></span
                    ><small>{{ point.label }}</small>
                  </div>
                }
              </div>
            }
            @case ('heatmap') {
              <div class="heatmap" aria-label="Intensidad diaria de movimientos">
                @for (point of timeline(); track point.key) {
                  <button
                    [style.--intensity]="(point.incomeP + point.expenseP) / 200"
                    [title]="point.label + ': ' + store.money(point.income + point.expense)"
                  >
                    <span>{{ point.label }}</span
                    ><b>{{ store.money(point.income + point.expense) }}</b>
                  </button>
                }
              </div>
            }
          }
        </article>
      }
    </section>
    @if (caps.allows(P.dashboard.tabla.ver)) {
      <section class="recent">
        <header>
          <div>
            <h2>Movimientos del periodo</h2>
          </div>
          @if (caps.allows(P.movimientos.ver)) {
            <a routerLink="/movements">Ver todos</a>
          }
        </header>
        <demo-table [columns]="columns" [rows]="rows()" (rowSelected)="inspect($event)" />
      </section>
    }
    @if (customizing() && (caps.allows(P.dashboard.widget.crear) || caps.allows(P.dashboard.widget.deshabilitar))) {
      <aside class="customize">
        <b>Diseño del dashboard</b>
        @if (caps.allows(P.dashboard.widget.crear)) {
          <button class="create-widget" type="button" (click)="widgetCreatorOpen.set(true)">
            <demo-icon name="plus" /> Crear widget
          </button>
        }
        @if (caps.allows(P.dashboard.widget.deshabilitar)) {
          @for (widget of hidden(); track widget.id) {
            <button type="button" (click)="show(widget.id)"><demo-icon name="plus" /> {{ widget.title }}</button>
          } @empty {
            <span>Todos visibles</span>
          }
        }
      </aside>
    }
    @if (widgetCreatorOpen()) {
      <demo-overlay title="Crear widget" mode="modal" (closed)="widgetCreatorOpen.set(false)">
        <form class="widget-builder" (submit)="createWidget($event)">
          <label>Nombre<input name="widgetTitle" [(ngModel)]="newWidgetTitle" required maxlength="48" /></label>
          <label
            >Visualización<demo-select
              name="widgetMetric"
              [(ngModel)]="newWidgetMetric"
              [options]="widgetTypeOptions"
              ariaLabel="Visualización del widget"
          /></label>
          <label
            >Distribución<demo-select
              name="widgetWidth"
              [(ngModel)]="newWidgetWidth"
              [options]="widgetWidthOptions"
              ariaLabel="Ancho del widget"
          /></label>
          <p>El widget respetará el periodo y los filtros enlazados del dashboard.</p>
          <div>
            <button type="button" class="quiet" (click)="widgetCreatorOpen.set(false)">Cancelar</button
            ><button type="submit">Agregar widget</button>
          </div>
        </form>
      </demo-overlay>
    }
    @if (selectedMovement(); as movement) {
      <demo-overlay title="Detalle del movimiento" mode="inspector" (closed)="store.inspector.set(null)"
        ><div class="detail">
          <span>MOVIMIENTO</span>
          <h2>{{ movement.description }}</h2>
          <strong>{{ store.money(movement.amount) }}</strong>
          <dl>
            <div>
              <dt>Fecha</dt>
              <dd>{{ movement.date }}</dd>
            </div>
            <div>
              <dt>Categoría</dt>
              <dd>{{ movement.category }}</dd>
            </div>
            <div>
              <dt>Cuenta</dt>
              <dd>{{ store.account(movement.accountId)?.name }}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{{ movement.status === 'confirmed' ? 'Confirmado' : 'Pendiente' }}</dd>
            </div>
          </dl>
          <a routerLink="/movements">Abrir en Movimientos</a>
        </div></demo-overlay
      >
    }
  </article>`,
  styles: [
    `
      .dashboard {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-width: 1800px;
        width: 100%;
        min-width: 0;
        margin: auto;
        overflow-x: clip;
      }
      .sin-acceso {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        padding: 28px;
        display: grid;
        gap: 8px;
        justify-items: start;
      }
      .sin-acceso h2 {
        margin: 0;
        font-size: 1.05rem;
      }
      .sin-acceso p {
        margin: 0;
        color: var(--muted);
        max-width: 60ch;
      }
      .sin-acceso code {
        background: var(--accent-soft);
        border-radius: 5px;
        padding: 1px 6px;
      }
      .hero,
      .filter-panel > header,
      .widget > header,
      .recent > header {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 20px;
      }
      .hero span,
      .filter-panel header span,
      .widget header span,
      .recent header span {
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        color: var(--accent);
        font-weight: 750;
      }
      h1 {
        font-family: var(--display);
        font-size: clamp(2rem, 3vw, 3.2rem);
        margin: 5px 0;
      }
      h2 {
        margin: 4px 0;
        font-size: 1rem;
      }
      p {
        margin: 0;
        color: var(--muted);
      }
      button,
      input,
      select {
        background: var(--surface);
        border: 1px solid var(--line);
        color: var(--text);
        border-radius: 9px;
        padding: 9px;
      }
      .filter-panel,
      .widget,
      .recent {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 18px;
      }
      .filter-panel {
        box-shadow: var(--shadow);
      }
      .filters {
        display: grid;
        grid-template-columns: 1.2fr repeat(4, minmax(130px, 1fr));
        gap: 12px;
        margin-top: 16px;
        align-items: end;
      }
      .filters > *,
      .filters label,
      .filters fieldset {
        min-width: 0;
      }
      .filters label,
      .local label,
      .period-nav {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 650;
      }
      .period-nav > div {
        display: grid;
        grid-template-columns: 34px minmax(130px, 1fr) 34px;
        align-items: center;
        margin-top: 6px;
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
        background: var(--surface);
      }
      .period-nav > div button {
        border: 0;
        border-radius: 0;
        padding: 8px;
      }
      .period-nav b {
        text-align: center;
        font-size: 0.76rem;
        color: var(--text);
      }
      .filters select,
      .filters input,
      .local select {
        width: 100%;
      }
      .filters fieldset {
        border: 0;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
      }
      .filters legend {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 650;
        margin-bottom: 6px;
      }
      .filters fieldset button {
        padding-inline: 5px;
      }
      .filters .active {
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
      }
      .quiet {
        background: transparent;
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .summary {
        font-size: 0.72rem;
        margin-top: 12px;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .kpis demo-kpi {
        min-width: 0;
      }
      .widget-actions {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .widget-actions button {
        padding: 6px 8px;
      }
      .widget-actions select {
        padding: 6px;
        max-width: 132px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        min-width: 0;
      }
      .widget {
        min-height: 310px;
        min-width: 0;
        overflow: hidden;
      }
      .widget.wide {
        grid-column: 1/-1;
      }
      .legend {
        display: flex;
        justify-content: flex-end;
        gap: 16px;
        font-size: 0.72rem;
        color: var(--muted);
      }
      .legend span {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .legend i,
      .category-list span > i {
        width: 9px;
        height: 9px;
        border-radius: 3px;
      }
      .inc {
        background: var(--accent);
      }
      .exp {
        background: var(--danger);
      }
      .line-visual {
        height: 230px;
        display: grid;
        grid-template-rows: 1fr 22px;
        margin-top: 12px;
        border-bottom: 1px solid var(--line);
        max-width: 100%;
        min-width: 0;
      }
      .line-visual svg {
        width: 100%;
        height: 205px;
        overflow: visible;
      }
      .line-visual polyline {
        fill: none;
        stroke-width: 4;
        vector-effect: non-scaling-stroke;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .income-line {
        stroke: var(--accent);
      }
      .expense-line {
        stroke: var(--danger);
      }
      .line-visual .area {
        stroke: none;
      }
      .income-area,
      .trend-area {
        fill: url(#incomeArea);
      }
      .expense-area {
        fill: url(#expenseArea);
      }
      .single .trend-area {
        fill: url(#trendArea);
      }
      .line-labels {
        display: flex;
        justify-content: space-between;
        min-width: 0;
        overflow: hidden;
        color: var(--muted);
      }
      .line-labels small {
        flex: 1;
        min-width: 0;
        text-align: center;
        font-size: 0.72rem;
        white-space: nowrap;
        overflow: hidden;
      }
      .line-labels small:not(:first-child):not(:last-child):not(:nth-child(5n)) {
        visibility: hidden;
      }
      .scatter {
        position: relative;
        height: 230px;
        margin: 18px 12px 18px 34px;
        border-left: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
        background: repeating-linear-gradient(to top, transparent 0 45px, var(--line) 46px);
      }
      .scatter > i {
        position: absolute;
        translate: -50% 50%;
        border-radius: 50%;
        background: color-mix(in srgb, var(--accent) 78%, transparent);
        border: 2px solid var(--surface);
        box-shadow: 0 0 0 1px var(--accent);
      }
      .axis-title {
        position: absolute;
        color: var(--muted);
        font-size: 0.72rem;
      }
      .scatter .axis-title.x {
        right: 0;
        bottom: -20px;
      }
      .scatter .axis-title.y {
        left: -34px;
        top: -14px;
      }
      .donut-layout {
        min-height: 235px;
        display: grid;
        grid-template-columns: minmax(150px, 220px) 1fr;
        gap: 24px;
        align-items: center;
      }
      .donut-chart {
        aspect-ratio: 1;
        border-radius: 50%;
        display: grid;
        place-items: center;
      }
      .donut-chart:before {
        content: '';
        position: absolute;
      }
      .donut-chart span {
        width: 58%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: var(--surface);
        display: grid;
        place-content: center;
        text-align: center;
      }
      .donut-chart small {
        color: var(--muted);
      }
      .donut-legend {
        display: grid;
        gap: 5px;
      }
      .donut-legend button {
        display: grid;
        grid-template-columns: 10px 1fr auto;
        gap: 8px;
        align-items: center;
        text-align: left;
      }
      .donut-legend i {
        height: 10px;
        border-radius: 3px;
      }
      .stacked {
        height: 230px;
        display: flex;
        gap: 7px;
        align-items: end;
        padding-top: 16px;
        border-bottom: 1px solid var(--line);
        overflow: hidden;
      }
      .stacked > div {
        height: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: end;
        min-width: 8px;
      }
      .stacked span {
        min-height: 2px;
      }
      .stack-income {
        background: var(--accent);
      }
      .stack-expense {
        background: var(--danger);
      }
      .stacked small {
        height: 20px;
        font-size: 0.72rem;
        color: var(--muted);
        overflow: hidden;
      }
      .heatmap {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
        gap: 7px;
        margin-top: 16px;
        max-height: 240px;
        overflow: auto;
        scrollbar-width: none;
      }
      .heatmap::-webkit-scrollbar {
        display: none;
      }
      .heatmap button {
        min-height: 62px;
        text-align: left;
        background: color-mix(in srgb, var(--accent) calc(var(--intensity) * 75%), var(--surface));
        display: grid;
      }
      .heatmap span {
        font-size: 0.72rem;
      }
      .heatmap b {
        font-size: 0.75rem;
      }
      .bar {
        flex: 1;
        min-width: 24px;
        display: grid;
        grid-template-rows: 1fr 22px;
      }
      .bar > div {
        display: flex;
        align-items: end;
        justify-content: center;
        gap: 3px;
      }
      .bar i {
        width: min(18px, 42%);
        min-height: 2px;
        border-radius: 5px 5px 0 0;
      }
      .bar small,
      .trend small {
        text-align: center;
        color: var(--muted);
        font-size: 0.72rem;
        overflow: hidden;
      }
      .local {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: end;
        gap: 8px;
        margin: 14px 0;
      }
      .category-list,
      .account-list {
        display: grid;
        gap: 7px;
      }
      .category-list button {
        display: grid;
        grid-template-columns: 1fr auto 42px;
        gap: 8px;
        text-align: left;
      }
      .category-list button > span {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .category-list small {
        text-align: right;
      }
      .category-list em {
        grid-column: 1/-1;
        background: var(--line);
        height: 5px;
        border-radius: 8px;
        overflow: hidden;
      }
      .category-list em i {
        display: block;
        height: 100%;
      }
      .selected {
        border-color: var(--accent) !important;
        background: var(--accent-soft) !important;
      }
      .account-list button {
        display: grid;
        grid-template-columns: 10px 1fr auto;
        align-items: center;
        gap: 10px;
        text-align: left;
      }
      .account-list button > i {
        height: 34px;
        border-radius: 8px;
      }
      .account-list span {
        display: grid;
      }
      .account-list small {
        color: var(--muted);
      }
      .trend {
        height: 230px;
        display: flex;
        align-items: stretch;
        gap: 6px;
        margin-top: 22px;
        border-bottom: 1px solid var(--line);
      }
      .trend > div {
        flex: 1;
        display: grid;
        grid-template-rows: 1fr 22px;
        align-items: end;
      }
      .trend span {
        display: block;
        min-height: 2px;
        background: linear-gradient(var(--accent), color-mix(in srgb, var(--accent) 30%, transparent));
        border-radius: 5px 5px 0 0;
      }
      .empty {
        margin: auto;
        text-align: center;
      }
      .recent {
        height: 520px;
        display: flex;
        flex-direction: column;
      }
      .recent a {
        color: var(--accent);
        font-size: 0.8rem;
      }
      .customize {
        position: fixed;
        right: 18px;
        bottom: 18px;
        background: var(--surface);
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
        border-radius: 12px;
        padding: 14px;
        display: flex;
        gap: 8px;
        align-items: center;
        z-index: 20;
      }
      .customize span {
        color: var(--muted);
        font-size: 0.75rem;
      }
      .widget-builder {
        display: grid;
        gap: 14px;
      }
      .widget-builder label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.78rem;
      }
      .widget-builder input,
      .widget-builder select {
        width: 100%;
      }
      .widget-builder > div {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .detail {
        display: grid;
        gap: 14px;
      }
      .detail > span {
        color: var(--accent);
        font-size: 0.72rem;
        letter-spacing: 0.12em;
      }
      .detail h2 {
        margin: 0;
      }
      .detail strong {
        font-size: 1.8rem;
      }
      .detail dl {
        margin: 0;
        display: grid;
        gap: 10px;
      }
      .detail dl div {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid var(--line);
        padding-bottom: 10px;
      }
      .detail dt {
        color: var(--muted);
      }
      .detail dd {
        margin: 0;
      }
      .detail > a {
        display: inline-flex;
        justify-content: center;
        padding: 12px;
        border-radius: 9px;
        background: var(--accent);
        color: var(--accent-contrast);
        text-decoration: none;
      }
      @media (max-width: 1200px) {
        .filters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .filters fieldset {
          grid-column: 1/-1;
        }
      }
      @media (max-width: 820px) {
        .kpis {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 700px) {
        .hero {
          align-items: start;
          flex-direction: column;
        }
        .filters {
          grid-template-columns: 1fr 1fr;
        }
        .filters fieldset {
          grid-column: 1/-1;
        }
        .grid {
          grid-template-columns: 1fr;
        }
        .widget.wide {
          grid-column: auto;
        }
        .bars {
          overflow-x: auto;
        }
        .bar {
          min-width: 34px;
        }
        .customize {
          left: 10px;
          right: 10px;
          overflow: auto;
        }
      }
      @media (max-width: 470px) {
        .filters,
        .kpis {
          grid-template-columns: 1fr;
        }
        .filters fieldset {
          grid-column: auto;
        }
        .local {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DashboardComponent {
  readonly P = P;
  private readonly api = inject(FinanceApiClient);
  readonly store = inject(DemoStore);
  readonly caps = inject(CAPABILITIES);
  readonly customizing = signal(false);

  /**
   * Personalizar agrupa cuatro acciones distintas: reordenar, cambiar de tipo, ocultar
   * y crear. El botón aparece si alguna está concedida, y dentro cada control comprueba
   * la suya. Así se puede dar «solo reorganizar» sin dar «cambiar de visualización».
   */
  readonly puedePersonalizar = computed(
    () =>
      this.caps.allows(P.dashboard.widget.orden.editar) ||
      this.caps.allows(P.dashboard.widget.tipo.editar) ||
      this.caps.allows(P.dashboard.widget.deshabilitar) ||
      this.caps.allows(P.dashboard.widget.crear),
  );

  /** Sin ningún KPI concedido la franja se retira entera, en vez de quedar vacía. */
  readonly algunKpi = computed(
    () =>
      this.caps.allows(P.dashboard.kpi.balance) ||
      this.caps.allows(P.dashboard.kpi.ingresos) ||
      this.caps.allows(P.dashboard.kpi.gastos) ||
      this.caps.allows(P.dashboard.kpi.recuento),
  );
  /**
   * Si no hay ni una pieza concedida, el panel no tiene nada que pintar.
   *
   * Es lo único que decide entre la pantalla y la explicación. Antes decidía
   * `dashboard.listar`, un permiso aparte que había que marcar además del de entrar:
   * conceder «ver dashboard» y un KPI pintaba la explicación y escondía el KPI, que era
   * justo lo que se había concedido. Cada pieza responde ahora por sí sola.
   */
  readonly nadaQueMostrar = computed(
    () =>
      !this.algunKpi() && !this.algunWidget() && !this.caps.allows(P.dashboard.tabla.ver) && !this.puedePersonalizar(),
  );

  /** Igual que los KPI: sin ninguna gráfica concedida, la rejilla no se pinta. */
  readonly algunWidget = computed(() =>
    [
      P.dashboard.widget.flujo,
      P.dashboard.widget.categorias,
      P.dashboard.widget.cuentas,
      P.dashboard.widget.tendencia,
      P.dashboard.widget.compromisos,
      P.dashboard.widget.salud,
      P.dashboard.widget.propios,
    ].some((codigo) => this.caps.allows(codigo)),
  );

  readonly scale = signal<Scale>('month');
  readonly anchor = signal('2026-08-31');
  readonly accountId = signal('all');
  readonly accountType = signal('all');
  readonly globalCategory = signal('all');
  readonly localCategory = signal('all');

  /**
   * Los filtros viven en la URL: una vista del dashboard se puede compartir y sobrevive
   * a una recarga. `localCategory` queda fuera a propósito — es la exploración de un
   * widget, no el contexto de la pantalla, y se promueve con «aplicar a todo».
   */
  private readonly urlDelDashboard = [
    sincronizarConLaUrl('escala', this.scale, 'month', (v) => ['day', 'week', 'month', 'year'].includes(v)),
    sincronizarConLaUrl('fecha', this.anchor, '2026-08-31', (v) => /^\d{4}-\d{2}-\d{2}$/.test(v)),
    sincronizarConLaUrl('cuenta', this.accountId, 'all'),
    sincronizarConLaUrl('tipo', this.accountType, 'all', (v) => ['all', 'credit', 'savings', 'cash'].includes(v)),
    sincronizarConLaUrl('categoria', this.globalCategory, 'all'),
  ];
  readonly hiddenIds = signal<string[]>([]);
  readonly widgetCreatorOpen = signal(false);
  newWidgetTitle = '';
  newWidgetMetric: WidgetType = 'trend';
  newWidgetWidth = 'wide';
  readonly accountTypeOptions: readonly UiOption[] = [
    { value: 'all', label: 'Todos los tipos' },
    { value: 'credit', label: 'Tarjetas de crédito' },
    { value: 'savings', label: 'Cuentas de ahorro' },
    { value: 'cash', label: 'Efectivo' },
  ];
  readonly widgetTypeOptions: readonly UiOption[] = [
    { value: 'flow', label: 'Líneas comparativas' },
    { value: 'trend', label: 'Área de tendencia' },
    { value: 'categories', label: 'Barras horizontales' },
    { value: 'accounts', label: 'Tabla resumida' },
    { value: 'scatter', label: 'Dispersión' },
    { value: 'donut', label: 'Composición radial' },
    { value: 'stacked', label: 'Área apilada' },
    { value: 'heatmap', label: 'Mapa de intensidad' },
  ];
  readonly widgetWidthOptions: readonly UiOption[] = [
    { value: 'wide', label: 'Ancho completo' },
    { value: 'half', label: 'Media pantalla' },
  ];
  readonly scales: { value: Scale; label: string }[] = [
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'year', label: 'Año' },
  ];
  readonly all = signal<Widget[]>([
    {
      id: 'flow',
      title: 'Flujo de caja',
      kicker: 'INGRESOS Y GASTOS',
      type: 'flow',
      wide: true,
      capability: P.dashboard.widget.flujo,
    },
    {
      id: 'categories',
      title: 'Gastos por categoría',
      kicker: 'DISTRIBUCIÓN INTERACTIVA',
      type: 'categories',
      wide: false,
      capability: P.dashboard.widget.categorias,
    },
    {
      id: 'accounts',
      title: 'Gasto por cuenta y tarjeta',
      kicker: 'MEDIOS DE PAGO',
      type: 'accounts',
      wide: false,
      capability: P.dashboard.widget.cuentas,
    },
    {
      id: 'trend',
      title: 'Evolución del gasto',
      kicker: 'TENDENCIA',
      type: 'trend',
      wide: true,
      capability: P.dashboard.widget.tendencia,
    },
    {
      id: 'commitments',
      title: 'Disponible tras compromisos',
      kicker: 'PRÓXIMOS 30 DÍAS',
      type: 'accounts',
      wide: false,
      capability: P.dashboard.widget.compromisos,
    },
    {
      id: 'health',
      title: 'Salud financiera',
      kicker: 'ALERTAS Y OPORTUNIDADES',
      type: 'categories',
      wide: false,
      capability: P.dashboard.widget.salud,
    },
  ]);
  canSee(widget: Widget): boolean {
    // Antes, un widget sin capacidad era visible para cualquiera, y los creados por
    // el usuario nacian asi. Ahora heredan el permiso de los widgets propios.
    return this.caps.allows(widget.capability ?? P.dashboard.widget.propios);
  }
  readonly widgets = computed(() => this.all().filter((w) => !this.hiddenIds().includes(w.id) && this.canSee(w)));
  readonly hidden = computed(() => this.all().filter((w) => this.hiddenIds().includes(w.id) && this.canSee(w)));
  readonly allCategories = computed(() => [...new Set(this.store.data().movements.map((m) => m.category))].sort());
  readonly accountOptions = computed(() =>
    this.store.data().accounts.filter((a) => this.accountType() === 'all' || a.type === this.accountType()),
  );
  readonly accountSelectOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: 'Todas las cuentas' },
    ...this.accountOptions().map((account) => ({ value: account.id, label: account.name })),
  ]);
  readonly categorySelectOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: 'Todas las categorías' },
    ...this.allCategories().map((category) => ({ value: category, label: category })),
  ]);
  readonly localCategoryOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: 'Todas' },
    ...this.localOptions().map((category) => ({ value: category, label: category })),
  ]);
  readonly range = computed(() => {
    const a = new Date(`${this.anchor()}T12:00:00`);
    let start: Date, end: Date;
    if (this.scale() === 'day') {
      start = new Date(a);
      end = new Date(a);
    } else if (this.scale() === 'week') {
      const offset = (a.getDay() + 6) % 7;
      start = new Date(a);
      start.setDate(a.getDate() - offset);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (this.scale() === 'month') {
      start = new Date(a.getFullYear(), a.getMonth(), 1, 12);
      end = new Date(a.getFullYear(), a.getMonth() + 1, 0, 12);
    } else {
      start = new Date(a.getFullYear(), 0, 1, 12);
      end = new Date(a.getFullYear(), 11, 31, 12);
    }
    return { start: this.iso(start), end: this.iso(end) };
  });
  readonly periodLabel = computed(() => {
    const f = (v: string) =>
      new Intl.DateTimeFormat(this.store.preferences().locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${v}T12:00:00Z`));
    return `${f(this.range().start)} – ${f(this.range().end)}`;
  });
  readonly periodShortLabel = computed(() => {
    const options: Intl.DateTimeFormatOptions =
      this.scale() === 'year'
        ? { year: 'numeric' }
        : this.scale() === 'month'
          ? { month: 'long', year: 'numeric' }
          : { day: 'numeric', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat(this.store.preferences().locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${this.anchor()}T12:00:00Z`),
    );
  });
  /**
   * Cifras del periodo calculadas por el servidor.
   *
   * El contrato de DashboardDto lo dice: «el cliente no suma saldos ni deduce deudas por
   * su cuenta». Hasta ahora esta pantalla lo incumplia porque calculaba sobre la pagina
   * de 25 movimientos del arranque, asi que sus numeros describian esa pagina y no el
   * periodo. En modo demo no hay servidor y se sigue calculando en local.
   */
  readonly remote = signal<ApiDashboard | null>(null);

  private readonly cargaRemota = effect(() => {
    const rango = this.range();
    if (this.store.runtime.mode !== 'api' || this.nadaQueMostrar()) return;
    void firstValueFrom(this.api.dashboard(rango.start, rango.end))
      .then((valor) => this.remote.set(valor))
      .catch(() => this.remote.set(null));
  });

  readonly base = computed(() =>
    this.store.data().movements.filter((m) => {
      const a = this.store.account(m.accountId);
      return (
        m.date >= this.range().start &&
        m.date <= this.range().end &&
        (this.accountId() === 'all' || m.accountId === this.accountId()) &&
        (this.accountType() === 'all' || a?.type === this.accountType())
      );
    }),
  );
  readonly localOptions = computed(() =>
    [
      ...new Set(
        this.base()
          .filter((m) => m.kind === 'expense')
          .map((m) => m.category),
      ),
    ].sort(),
  );
  readonly movements = computed(() =>
    this.base().filter((m) => this.globalCategory() === 'all' || m.category === this.globalCategory()),
  );
  readonly income = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.income);
    return sumBy(
      this.movements().filter((m) => m.kind === 'income'),
      (m) => Math.max(0, m.amount),
    );
  });
  readonly expense = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.expense);
    return sumBy(
      this.movements().filter((m) => m.kind === 'expense'),
      (m) => -Math.min(0, m.amount),
    );
  });
  readonly net = computed(() => {
    const remoto = this.remoteAplicable();
    if (remoto) return parseMoney(remoto.period.net);
    return sumBy(this.movements(), (m) => m.amount);
  });

  /**
   * El servidor no conoce los filtros locales de cuenta, tipo o categoria. Mientras
   * haya alguno activo, la cifra del servidor no responde a lo que el usuario ve, asi
   * que manda el calculo local sobre lo cargado. Sin filtros, manda el servidor.
   */
  private readonly remoteAplicable = computed(() => {
    const sinFiltrosLocales =
      this.accountId() === 'all' && this.accountType() === 'all' && this.globalCategory() === 'all';
    const remoto = this.remote();
    return sinFiltrosLocales && remoto && remoto.period.period.start === this.range().start ? remoto : null;
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
          income: m.kind === 'income' && m.amount > 0 ? m.amount : 0,
          expense: m.kind === 'expense' && m.amount < 0 ? -m.amount : 0,
        }));
    const map = new Map<string, { key: string; label: string; income: number; expense: number }>();
    for (const m of puntos) {
      const d = new Date(`${m.date}T12:00:00Z`),
        key = this.scale() === 'year' ? m.date.slice(0, 7) : m.date,
        label =
          this.scale() === 'year'
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
      if (
        m.kind === 'expense' &&
        m.amount < 0 &&
        (this.localCategory() === 'all' || m.category === this.localCategory())
      )
        totals.set(m.category, (totals.get(m.category) ?? 0) - m.amount);
    const total = [...totals.values()].reduce((s, v) => s + v, 0),
      colors = ['#07836b', '#dc554e', '#d3a34a', '#4e83b5', '#8055a8', '#64748b'];
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
        amount: -this.movements()
          .filter((m) => m.accountId === a.id && m.kind === 'expense' && m.amount < 0)
          .reduce((s, m) => s + m.amount, 0),
      }))
      .filter((a) => a.amount > 0)
      .sort((a, b) => b.amount - a.amount),
  );
  readonly scatterPoints = computed(() =>
    this.movements()
      .filter((m) => m.amount !== 0)
      .slice(0, 80)
      .map((m, index, items) => ({
        id: m.id,
        x: items.length === 1 ? 50 : 4 + (index / (items.length - 1)) * 92,
        y: 8 + Math.min(84, (Math.abs(m.amount) / Math.max(1, ...items.map((x) => Math.abs(x.amount)))) * 84),
        size: 8 + Math.min(12, (Math.abs(m.amount) / Math.max(1, ...items.map((x) => Math.abs(x.amount)))) * 12),
        label: `${m.date} · ${m.description} · ${this.store.money(m.amount)}`,
      })),
  );
  readonly donutGradient = computed(() => {
    let offset = 0;
    const slices = this.categoryDistribution()
      .slice(0, 6)
      .map((item) => {
        const start = offset;
        offset += item.percent;
        return `${item.color} ${start}% ${offset}%`;
      });
    return `conic-gradient(${slices.join(',') || 'var(--line) 0 100%'})`;
  });
  readonly hasFilters = computed(
    () =>
      this.scale() !== 'month' ||
      this.anchor() !== '2026-08-31' ||
      this.accountId() !== 'all' ||
      this.accountType() !== 'all' ||
      this.globalCategory() !== 'all' ||
      this.localCategory() !== 'all',
  );
  readonly selectedMovement = computed(() => {
    const s = this.store.inspector();
    return s?.type === 'movement' ? this.store.data().movements.find((m) => m.id === s.id) : undefined;
  });
  readonly columns = [
    { key: 'date', label: 'Fecha' },
    { key: 'description', label: 'Descripción' },
    { key: 'category', label: 'Categoría' },
    { key: 'account', label: 'Cuenta' },
    { key: 'amount', label: 'Importe' },
  ];
  readonly rows = computed(() =>
    this.movements()
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => ({
        id: m.id,
        date: m.date,
        description: m.description,
        category: m.category,
        account: this.store.account(m.accountId)?.name,
        amount: this.store.money(m.amount),
      })),
  );
  changeAccountType(type: string) {
    this.accountType.set(type);
    if (this.accountId() !== 'all' && !this.accountOptions().some((a) => a.id === this.accountId()))
      this.accountId.set('all');
  }
  promoteCategory() {
    this.globalCategory.set(this.localCategory());
    this.store.log(`Filtro global aplicado: ${this.localCategory()}`);
  }
  reset() {
    this.scale.set('month');
    this.anchor.set('2026-08-31');
    this.accountId.set('all');
    this.accountType.set('all');
    this.globalCategory.set('all');
    this.localCategory.set('all');
  }
  hide(id: string) {
    if (!this.caps.allows(P.dashboard.widget.deshabilitar)) return;
    this.hiddenIds.update((x) => [...x, id]);
  }
  show(id: string) {
    if (!this.caps.allows(P.dashboard.widget.deshabilitar)) return;
    this.hiddenIds.update((x) => x.filter((v) => v !== id));
  }
  move(id: string, direction: number) {
    if (!this.caps.allows(P.dashboard.widget.orden.editar)) return;
    this.all.update((items) => {
      const next = [...items],
        index = next.findIndex((item) => item.id === id),
        target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  changeType(id: string, type: string) {
    if (!this.caps.allows(P.dashboard.widget.tipo.editar)) return;
    this.all.update((items) => items.map((item) => (item.id === id ? { ...item, type: type as WidgetType } : item)));
  }
  createWidget(event: Event) {
    event.preventDefault();
    if (!this.caps.allows(P.dashboard.widget.crear)) return;
    const title = this.newWidgetTitle.trim();
    if (!title) return;
    this.all.update((items) => [
      ...items,
      {
        id: `custom-${Date.now()}`,
        title,
        kicker: 'ANÁLISIS PERSONAL',
        type: this.newWidgetMetric,
        wide: this.newWidgetWidth === 'wide',
      },
    ]);
    this.newWidgetTitle = '';
    this.widgetCreatorOpen.set(false);
    this.store.log(`Widget agregado: ${title}`);
  }
  linePoints(kind: 'income' | 'expense') {
    const values = this.timeline();
    if (!values.length) return '';
    return values
      .map((point, index) => {
        const x = values.length === 1 ? 500 : (index / (values.length - 1)) * 1000;
        const y = 220 - point[`${kind}P`] * 1.9;
        return `${x.toFixed(1)},${Math.max(18, y).toFixed(1)}`;
      })
      .join(' ');
  }
  areaPath(kind: 'income' | 'expense') {
    const points = this.linePoints(kind);
    if (!points) return '';
    return `M ${points.replaceAll(' ', ' L ')} L 1000 230 L 0 230 Z`;
  }
  shiftPeriod(direction: number) {
    const date = new Date(`${this.anchor()}T12:00:00`);
    if (this.scale() === 'year') date.setFullYear(date.getFullYear() + direction);
    else if (this.scale() === 'month') date.setMonth(date.getMonth() + direction);
    else date.setDate(date.getDate() + direction * (this.scale() === 'week' ? 7 : 1));
    this.anchor.set(this.iso(date));
  }
  inspect(row: Record<string, unknown>) {
    if (!this.caps.allows(P.dashboard.detalle.ver)) return;
    this.store.inspect('movement', String(row['id']));
  }
  typeLabel(type: string) {
    return (
      ({ credit: 'Tarjeta de crédito', savings: 'Cuenta de ahorro', cash: 'Efectivo' } as Record<string, string>)[
        type
      ] ?? type
    );
  }
  private iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
