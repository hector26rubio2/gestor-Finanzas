import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AccountFormComponent, ManagementFormComponent } from '../forms';
import { toCsv, downloadCsv } from '../core/csv';
import { P } from '../core/permissions';
import { applyTheme, CAPABILITIES, DemoStore } from '../core/store';
import { DataTableComponent, KpiComponent, OverlayComponent } from '../ui/ui';
import {
  ApiAuditEvent,
  ApiMovement,
  ApiProjectedOccurrence,
  ApiRecurrence,
  FinanceApiClient,
} from '../core/api-client';
import { firstValueFrom } from 'rxjs';
import { DemoAuditEvent } from '../core/demo-data';
import { parseMoney } from '../core/money';
import { signOf } from '../core/movement-kinds';

const labels: Record<string, { title: string; eyebrow: string; description: string }> = {
  movements: {
    title: 'Movimientos',
    eyebrow: 'LIBRO CENTRAL',
    description: 'Todos los efectos económicos, en un único lugar.',
  },
  calendar: {
    title: 'Calendario',
    eyebrow: 'AGENDA FINANCIERA',
    description: 'Consulta operaciones y compromisos sin deformar el calendario.',
  },
  accounts: {
    title: 'Cuentas y tarjetas',
    eyebrow: 'MI DINERO',
    description: 'Explora cuentas, tarjetas y sus movimientos relacionados.',
  },
  people: {
    title: 'Personas y deudas',
    eyebrow: 'OBLIGACIONES',
    description: 'Lo que debes y lo que te deben, sin compensaciones engañosas.',
  },
  portfolio: {
    title: 'Patrimonio e inversiones',
    eyebrow: 'PATRIMONIO',
    description: 'Activos, pasivos y posiciones vinculadas a movimientos.',
  },
  planning: {
    title: 'Planificación',
    eyebrow: 'PROYECCIONES',
    description: 'Compara alternativas sin modificar movimientos reales.',
  },
  reports: {
    title: 'Reportes',
    eyebrow: 'ANÁLISIS',
    description: 'Entiende qué ocurrió y abre los movimientos que explican cada cifra.',
  },
  notifications: {
    title: 'Notificaciones',
    eyebrow: 'TRABAJO PENDIENTE',
    description: 'Revisa propuestas antes de convertirlas en movimientos.',
  },
  admin: {
    title: 'Administración',
    eyebrow: 'ORGANIZACIÓN',
    description: 'Miembros, capacidades y trazabilidad de la organización.',
  },
  settings: {
    title: 'Preferencias',
    eyebrow: 'TU EXPERIENCIA',
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
    DataTableComponent,
    KpiComponent,
    OverlayComponent,
    AccountFormComponent,
    ManagementFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="workspace-page">
      <header class="page-head">
        <div>
          <span>{{ meta().eyebrow }}</span>
          <h1>{{ meta().title }}</h1>
          <p>{{ meta().description }}</p>
        </div>
        <div class="head-actions">
          @if (page() === 'accounts' && can(P.cuentas.crear)) {
            <button (click)="store.form.set({ kind: 'account' })">＋ Nueva cuenta</button>
          }
          @if (page() === 'movements' && can(P.cuentas.categorias.crear)) {
            <button class="secondary-action" (click)="store.form.set({ kind: 'category' })">＋ Nueva categoría</button>
          }
          @if (page() === 'people' && can(P.personas.crear)) {
            <button (click)="store.form.set({ kind: 'person' })">＋ Persona</button>
          }
          @if (page() === 'portfolio' && can(P.patrimonio.inversiones.crear)) {
            <button (click)="store.form.set({ kind: 'investment' })">＋ Inversión</button>
          }
          @if (page() === 'reports' && can(P.reportes.exportar)) {
            <button (click)="exportReport()">⇩ Exportar CSV</button>
          }
          @if (page() === 'movements' && can(P.reportes.exportar)) {
            <button class="secondary-action" (click)="exportMovements()">⇩ Exportar CSV</button>
          }
          @if (page() === 'notifications' && can(P.notificaciones.editar)) {
            <button (click)="readAll()">Marcar como leídas</button>
          }
        </div>
      </header>
      @switch (page()) {
        @case ('movements') {
          <ng-container *ngTemplateOutlet="movements"></ng-container>
        }
        @case ('accounts') {
          <ng-container *ngTemplateOutlet="accounts"></ng-container>
        }
        @case ('calendar') {
          <ng-container *ngTemplateOutlet="calendar"></ng-container>
        }
        @case ('people') {
          <ng-container *ngTemplateOutlet="people"></ng-container>
        }
        @case ('portfolio') {
          <ng-container *ngTemplateOutlet="portfolio"></ng-container>
        }
        @case ('planning') {
          <ng-container *ngTemplateOutlet="planning"></ng-container>
        }
        @case ('reports') {
          <ng-container *ngTemplateOutlet="reports"></ng-container>
        }
        @case ('notifications') {
          <ng-container *ngTemplateOutlet="notifications"></ng-container>
        }
        @case ('settings') {
          <ng-container *ngTemplateOutlet="settings"></ng-container>
        }
      }
    </article>
    <ng-template #filters
      ><button
        type="button"
        class="filters-toggle"
        [attr.aria-expanded]="filtersOpen()"
        aria-controls="panel-filtros"
        (click)="filtersOpen.update((open) => !open)"
      >
        Filtros
        @if (activeFilterCount()) {
          <i>{{ activeFilterCount() }}</i>
        }
      </button>
      <section class="filters" id="panel-filtros" [class.collapsed]="!filtersOpen()">
        <label
          >Buscar<input
            #searchInput
            aria-label="Buscar movimientos"
            placeholder="Descripción, categoría o persona"
            [ngModel]="store.query()"
            (ngModelChange)="store.query.set($event); loadMovementPage(1)" /></label
        ><label
          >Periodo<select [ngModel]="store.period()" (ngModelChange)="store.period.set($event); loadMovementPage(1)">
            <option value="all">Últimos 12 meses</option>
            @for (m of months; track m.value) {
              <option [value]="m.value">{{ m.label }}</option>
            }
          </select></label
        ><label
          >Cuenta<select
            [ngModel]="store.accountFilter()"
            (ngModelChange)="store.accountFilter.set($event); loadMovementPage(1)"
          >
            <option value="all">Todas las cuentas</option>
            @for (a of store.data().accounts; track a.id) {
              <option [value]="a.id">{{ a.name }}</option>
            }
          </select></label
        ><label
          >Tipo de cuenta<select [ngModel]="movementAccountType()" (ngModelChange)="movementAccountType.set($event)">
            <option value="all">Todos</option>
            <option value="savings">Ahorros</option>
            <option value="credit">Crédito</option>
            <option value="cash">Efectivo</option>
          </select></label
        ><label
          >Categoría<select [ngModel]="movementCategory()" (ngModelChange)="movementCategory.set($event)">
            <option value="all">Todas</option>
            @for (category of movementCategories(); track category) {
              <option [value]="category">{{ category }}</option>
            }
          </select></label
        ><label
          >Operación<select [ngModel]="movementOperation()" (ngModelChange)="movementOperation.set($event)">
            <option value="all">Todas</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos / compras</option>
            <option value="transfer">Transferencias</option>
            <option value="loan">Préstamos y créditos</option>
            <option value="recurring">Recurrentes</option>
          </select></label
        >
        @if (hasActiveFilters()) {
          <button type="button" class="quiet-reset" (click)="clearFilters()">Restablecer filtros</button>
        }
      </section></ng-template
    >
    <ng-template #movements
      ><ng-container *ngTemplateOutlet="filters"></ng-container>
      <section class="kpis mini">
        <demo-kpi
          label="Ingresos filtrados"
          [value]="store.money(store.income())"
          hint="Conjunto seleccionado"
        /><demo-kpi
          label="Gastos filtrados"
          [value]="store.money(store.expense())"
          hint="Conjunto seleccionado"
        /><demo-kpi label="Registros" [value]="store.movements().length.toString()" hint="Confirmados y pendientes" />
      </section>
      <section class="table-zone">
        <demo-table
          [columns]="movementColumns"
          [rows]="movementRows()"
          [pageSize]="store.remoteMovementSize()"
          [totalRows]="store.runtime.mode === 'api' ? store.remoteMovementTotal() : null"
          [remotePage]="store.remoteMovementPage()"
          (pageSizeChange)="changeMovementPageSize($event)"
          (pageChange)="loadMovementPage($event)"
          (rowSelected)="inspectMovement($event)"
        ></demo-table></section
    ></ng-template>
    <ng-template #accounts
      ><section class="account-kpis kpis mini">
        <demo-kpi label="Disponible" [value]="store.money(store.available())" hint="Cuentas de efectivo" /><demo-kpi
          label="Deuda en tarjetas"
          [value]="store.money(store.debt())"
          hint="Sin descontar cuentas por cobrar"
        /><demo-kpi label="Cuentas" [value]="store.data().accounts.length.toString()" hint="Activas actualmente" />
      </section>
      <section class="account-tools" aria-label="Filtros de cuentas y tarjetas">
        <label
          ><span>Buscar cuenta</span>
          <div class="search-control">
            <span aria-hidden="true">⌕</span
            ><input
              type="search"
              placeholder="Nombre o terminación"
              [ngModel]="accountQuery()"
              (ngModelChange)="setAccountQuery($event)"
            /></div
        ></label>
        <label
          ><span>Tipo de cuenta</span
          ><select [ngModel]="accountType()" (ngModelChange)="setAccountType($event)">
            <option value="all">Todas</option>
            <option value="savings">Ahorros</option>
            <option value="credit">Crédito</option>
            <option value="cash">Efectivo</option>
          </select></label
        >
        <span>{{ filteredAccounts().length }} resultados</span>
      </section>
      <section class="cards" [class.compact]="compactCards()">
        <div class="card-strip" tabindex="0" aria-label="Lista desplazable de cuentas">
          @for (a of visibleAccounts(); track a.id) {
            <button
              class="bank-card"
              [style.--card-color]="a.color"
              [class.active]="selectedAccountFilter() === a.id"
              (click)="selectAccount(a.id, a.type)"
            >
              <span>{{ a.type === 'credit' ? 'CRÉDITO' : a.type === 'savings' ? 'AHORROS' : 'EFECTIVO' }}</span
              ><b>{{ a.name }}</b
              ><em>{{ a.lastFour ? '•••• ' + a.lastFour : 'Sin terminación' }}</em
              ><small
                >{{ a.type === 'credit' ? 'Deuda' : 'Saldo' }}
                <strong>{{ store.money(displayBalance(a)) }}</strong></small
              >
            </button>
          }
        </div>
        @if (filteredAccounts().length > accountPageSize) {
          <nav class="card-pages" aria-label="Páginas de cuentas">
            <button (click)="accountPage.update((p) => Math.max(0, p - 1))" [disabled]="accountPage() === 0">‹</button
            ><span>{{ accountPage() + 1 }} / {{ accountPageCount() }}</span
            ><button
              (click)="accountPage.update((p) => Math.min(accountPageCount() - 1, p + 1))"
              [disabled]="accountPage() >= accountPageCount() - 1"
            >
              ›
            </button>
          </nav>
        }
        <button class="compact-toggle" (click)="compactCards.update((v) => !v)">
          {{ compactCards() ? 'Expandir tarjetas' : 'Compactar tarjetas' }}
        </button>
      </section>
      <section class="table-zone">
        <demo-table
          [columns]="movementColumns"
          [rows]="accountMovementRows()"
          [pageSize]="store.remoteMovementSize()"
          [totalRows]="store.runtime.mode === 'api' ? store.remoteMovementTotal() : null"
          [remotePage]="store.remoteMovementPage()"
          (pageSizeChange)="compactCards.set($event > 5); changeMovementPageSize($event)"
          (pageChange)="loadMovementPage($event)"
          (rowSelected)="inspectMovement($event)"
        /></section
    ></ng-template>
    <ng-template #calendar
      ><section class="calendar-layout">
        <div class="month">
          <header class="calendar-toolbar">
            <button type="button" class="icon-button" aria-label="Periodo anterior" (click)="shiftCalendar(-1)">
              ‹
            </button>
            <div class="calendar-title">
              <span>PERIODO</span><strong>{{ calendarTitle() }}</strong>
            </div>
            <div class="period-tabs" role="group" aria-label="Escala de calendario">
              @for (view of calendarViews; track view.value) {
                <button
                  type="button"
                  [class.active]="calendarView() === view.value"
                  (click)="setCalendarView(view.value)"
                >
                  {{ view.label }}
                </button>
              }
            </div>
            <button type="button" class="today-button" (click)="goCalendarToday()">Hoy</button>
            <button type="button" class="icon-button" aria-label="Periodo siguiente" (click)="shiftCalendar(1)">
              ›
            </button>
          </header>
          @if (calendarView() === 'year') {
            <div class="year-grid" aria-label="Meses del año">
              @for (month of calendarMonths; track month.value) {
                <button type="button" (click)="openCalendarMonth(month.value)">
                  <span>{{ month.label }}</span
                  ><b>{{ monthMovementCount(month.value) }}</b
                  ><small>operaciones</small>
                </button>
              }
            </div>
          } @else {
            <div class="week names">
              @for (d of week; track d) {
                <b>{{ d }}</b>
              }
            </div>
            <div
              class="week grid"
              [class.week-view]="calendarView() === 'week'"
              [class.day-view]="calendarView() === 'day'"
            >
              @for (day of visibleCalendarDays(); track day.iso) {
                <button
                  [attr.aria-pressed]="day.iso === selectedCalendarDate()"
                  [attr.aria-label]="day.label + ', ' + dayMoves(day.iso).length + ' movimientos'"
                  [class.selected]="day.iso === selectedCalendarDate()"
                  [class.outside]="!day.current"
                  (click)="selectCalendarDay(day.iso)"
                >
                  <b>{{ day.day }}</b>
                  @for (m of dayMoves(day.iso).slice(0, calendarView() === 'day' ? 8 : 2); track m.id) {
                    <span [class.income]="m.amount > 0">{{ m.description }}</span>
                  }
                  @if (dayMoves(day.iso).length > (calendarView() === 'day' ? 8 : 2)) {
                    <em>+{{ dayMoves(day.iso).length - (calendarView() === 'day' ? 8 : 2) }} más</em>
                  }
                </button>
              }
            </div>
          }
        </div>
        <aside class="agenda">
          <h3>Próximos compromisos</h3>
          @for (item of projectedOccurrences(); track item.recurrence.id + item.occurrence) {
            <button class="projected" [disabled]="!can(P.calendario.proyecciones.crear)" (click)="materialize(item)">
              <span>{{ item.recurrence.name }} · proyectado</span
              ><b>{{ store.money(+item.amount.amount, item.amount.currency) }}</b>
            </button>
          }
          @for (m of store.data().movements.slice(0, 7); track m.id) {
            <button (click)="store.inspect('movement', m.id)">
              <span>{{ m.description }}</span
              ><b>{{ store.money(m.amount) }}</b>
            </button>
          }
        </aside>
      </section></ng-template
    >
    <ng-template #people
      ><section class="kpis mini">
        <demo-kpi label="Me deben" [value]="store.money(peopleOwed())" hint="Cuentas por cobrar" /><demo-kpi
          label="Les debo"
          [value]="store.money(peopleOwing())"
          hint="Obligaciones propias"
        /><demo-kpi
          label="Personas"
          [value]="store.data().people.length.toString()"
          hint="Con relaciones activas"
        /><demo-kpi
          label="Mayor retraso"
          [value]="slowestPayer().name"
          [hint]="slowestPayer().days + ' días promedio'"
        />
      </section>
      <section class="table-zone">
        <demo-table
          [columns]="peopleColumns"
          [rows]="peopleRows()"
          (rowSelected)="store.inspect('person', $event['id'])"
        /></section
    ></ng-template>
    <ng-template #portfolio
      ><section class="kpis mini">
        <demo-kpi
          label="Patrimonio disponible"
          [value]="store.money(store.available() - store.debt())"
          hint="Valor de mercado estimado"
        /><demo-kpi
          label="Inversiones"
          [value]="store.money(investmentValue())"
          hint="Valoración ilustrativa"
        /><demo-kpi label="Rendimiento" [value]="investmentReturn()" hint="No es una garantía" /><demo-kpi
          label="Ganancia no realizada"
          [value]="store.money(investmentGain())"
          hint="Valor actual menos costo"
        />
      </section>
      <section class="table-zone">
        <demo-table
          [columns]="investmentColumns"
          [rows]="investmentRows()"
          (rowSelected)="store.inspect('investment', $event['id'])"
        /></section
    ></ng-template>
    <ng-template #planning
      ><nav class="tabs" role="tablist" aria-label="Tipo de simulación">
        @for (tab of planningTabs; track tab) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="planningTab() === tab"
            [class.active]="planningTab() === tab"
            (click)="planningTab.set(tab)"
          >
            {{ tab }}
          </button>
        }
      </nav>
      <section class="scenario-planner" role="tabpanel" [attr.aria-label]="'Planificación de ' + planningTab()">
        <aside class="planner-controls">
          <header>
            <span>PARÁMETROS</span>
            <h2>{{ planningCopy().parameterTitle }}</h2>
            <p>{{ planningCopy().helper }}</p>
          </header>
          <label
            >{{ planningCopy().amountLabel
            }}<input
              type="range"
              [min]="planningCopy().min"
              [max]="planningCopy().max"
              [step]="planningCopy().step"
              [ngModel]="monthly()"
              (ngModelChange)="monthly.set(+$event)"
            /><b>{{ store.money(monthly()) }}</b
            ><small>{{ planningCopy().rangeHint }}</small></label
          ><label>Fecha objetivo<input type="date" [(ngModel)]="targetDate" /></label>
          <div class="planner-note">
            <b>Supuesto del cálculo</b><span>{{ planningCopy().assumption }}</span>
          </div>
        </aside>
        <div class="planner-results">
          <section class="planner-kpis" aria-label="Comparación del plan">
            @for (metric of planningMetrics(); track metric.label) {
              <article>
                <span>{{ metric.label }}</span
                ><strong>{{ metric.value }}</strong
                ><small>{{ metric.hint }}</small>
              </article>
            }
          </section>
          <article class="projection-card">
            <header>
              <div>
                <span>PROYECCIÓN</span>
                <h2>{{ planningCopy().chartTitle }}</h2>
                <p>{{ planningCopy().chartDescription }}</p>
              </div>
              <div class="chart-legend">
                <span class="current-key">{{ planningCopy().currentLabel }}</span
                ><span class="proposal-key">{{ planningCopy().proposedLabel }}</span>
              </div>
            </header>
            <div class="projection-plot" role="img" [attr.aria-label]="planningCopy().chartDescription">
              <div class="y-labels">
                <span>{{ compactMoney(planningChartMax()) }}</span
                ><span>{{ compactMoney(planningChartMax() / 2) }}</span
                ><span>$0</span>
              </div>
              <svg viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true">
                <g class="grid-lines">
                  <line x1="0" y1="10" x2="600" y2="10" />
                  <line x1="0" y1="110" x2="600" y2="110" />
                  <line x1="0" y1="210" x2="600" y2="210" />
                </g>
                <polyline class="current-line" [attr.points]="planningCurrentPoints()" />
                <polyline class="proposal-line" [attr.points]="planningProposedPoints()" />
              </svg>
              <div class="x-labels">
                <span>Hoy</span><span>3 meses</span><span>6 meses</span><span>9 meses</span><span>12 meses</span>
              </div>
            </div>
          </article>
          <p class="planner-disclaimer">
            Estimación orientativa basada en los movimientos registrados y los supuestos visibles. No modifica tus
            saldos.
          </p>
        </div>
      </section></ng-template
    >
    <ng-template #reports
      ><section class="report-toolbar" aria-label="Filtros de reportes">
        <label
          >Periodo<select [ngModel]="reportPeriod()" (ngModelChange)="reportPeriod.set($event)">
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
            <option value="12">12 meses</option>
          </select></label
        >
        <p>Todos los indicadores conservan trazabilidad al libro central.</p>
        @if (can(P.reportes.exportar)) {
          <button type="button" class="export-action" (click)="exportReport()">⇩ Exportar CSV</button>
        }
      </section>
      <section class="kpis mini report-kpis">
        <demo-kpi label="Flujo neto" [value]="store.money(reportNet())" hint="Ingresos menos gastos" />
        <demo-kpi label="Tasa de ahorro" [value]="reportSavingsRate()" hint="Sobre ingresos del periodo" />
        <demo-kpi label="Gasto promedio" [value]="store.money(reportAverageExpense())" hint="Promedio mensual" />
        <demo-kpi label="Mayor categoría" [value]="topCategory().name" [hint]="store.money(topCategory().value)" />
      </section>
      <section class="report-grid">
        <div class="chart">
          <h2>Ingresos frente a gastos</h2>
          <p class="chart-description">Comparación mensual; verde representa ingresos y coral representa gastos.</p>
          <div class="chart-legend">
            <span class="income-key">Ingresos</span><span class="expense-key">Gastos</span>
          </div>
          <div class="paired-bars" role="img" aria-label="Ingresos y gastos mensuales en pesos colombianos">
            @for (v of reportSeries(); track v.month) {
              <div>
                <span class="pair"
                  ><i [style.height.%]="v.incomePercent"
                    ><em>{{ compactMoney(v.income) }}</em></i
                  ><i [style.height.%]="v.expensePercent"
                    ><em>{{ compactMoney(v.expense) }}</em></i
                  ></span
                ><b>{{ v.month }}</b>
              </div>
            }
          </div>
          <small class="chart-unit">Importes en COP · cada barra representa un mes</small>
        </div>
        <div class="chart">
          <h2>Gastos por categoría</h2>
          <p class="chart-description">Participación de las categorías con mayor gasto.</p>
          <div class="category-report">
            <div class="donut">
              <b>{{ store.money(reportExpenses()) }}</b>
            </div>
            <ul>
              @for (category of reportCategories(); track category.name) {
                <li>
                  <i [style.background]="category.color"></i><span>{{ category.name }}</span
                  ><b>{{ category.percent }} % · {{ compactMoney(category.value) }}</b>
                </li>
              }
            </ul>
          </div>
        </div>
        <div class="chart full">
          <h2>Tendencia mensual</h2>
          <p class="chart-description">Evolución del flujo neto del periodo seleccionado.</p>
          <div class="report-line" role="img" aria-label="Flujo neto mensual en pesos colombianos">
            <span class="axis-y"
              ><b>{{ compactMoney(reportNetRange()) }}</b
              ><em>$0</em><b>-{{ compactMoney(reportNetRange()) }}</b></span
            ><svg viewBox="0 0 600 160" preserveAspectRatio="none">
              <line class="zero" x1="0" y1="80" x2="600" y2="80" />
              <polyline [attr.points]="reportNetPoints()" />
            </svg>
            <div class="axis-x">
              @for (v of reportSeries(); track v.month) {
                <span
                  >{{ v.month }}<small>{{ compactMoney(v.net) }}</small></span
                >
              }
            </div>
          </div>
          <small class="chart-unit">Flujo neto = ingresos − gastos · importes en COP</small>
        </div>
        <div class="chart">
          <h2>Salud de deuda</h2>
          <dl class="report-facts">
            <div>
              <dt>Utilización de cupo</dt>
              <dd>34 %</dd>
            </div>
            <div>
              <dt>Próximo vencimiento</dt>
              <dd>5 sep</dd>
            </div>
            <div>
              <dt>Intereses estimados</dt>
              <dd>{{ store.money(184000) }}</dd>
            </div>
          </dl>
        </div>
        <div class="chart">
          <h2>Patrimonio</h2>
          <dl class="report-facts">
            <div>
              <dt>Activos líquidos</dt>
              <dd>{{ store.money(store.available()) }}</dd>
            </div>
            <div>
              <dt>Inversiones</dt>
              <dd>{{ store.money(investmentValue()) }}</dd>
            </div>
            <div>
              <dt>Deuda</dt>
              <dd>{{ store.money(store.debt()) }}</dd>
            </div>
          </dl>
        </div>
        <div class="chart full">
          <h2>Hallazgos del periodo</h2>
          <ul class="insights">
            <li>Los gastos variables representan el 41 % del total.</li>
            <li>La categoría Hogar aumentó frente al periodo anterior.</li>
            <li>Hay 3 cargos pendientes de clasificación.</li>
          </ul>
        </div>
      </section></ng-template
    >
    <ng-template #notifications
      ><section class="notice-list">
        @for (n of store.data().notifications; track n.id) {
          <article [class.unread]="!n.read">
            <span>◎</span>
            <div>
              <h2>{{ n.title }}</h2>
              <p>{{ n.detail }}</p>
            </div>
            @if (n.id === 'notice-purchase') {
              <button (click)="reviewNotification(n.id)">Revisar</button>
            } @else if (can(P.notificaciones.editar)) {
              <button (click)="mark(n.id)">Marcar leída</button>
            }
          </article>
        }
      </section></ng-template
    >
    <ng-template #settings
      ><section class="settings-grid">
        <article class="wide">
          <h2>Apariencia</h2>
          <p>Crea una identidad personal, comprueba su contraste en la vista previa y guárdala para este usuario.</p>
          <label
            >Nombre del tema<input
              [disabled]="!canCustomize()"
              [ngModel]="store.preferences().name"
              (ngModelChange)="setThemeValue('name', $event)"
          /></label>
          <div class="theme-picks">
            @for (theme of themes; track theme.id) {
              <button
                [attr.aria-pressed]="store.preferences().theme === theme.id"
                [disabled]="!can(P.preferencias.editar)"
                (click)="setTheme(theme.id)"
              >
                <i [style.background]="theme.preview"></i>{{ theme.label }}
              </button>
            }
          </div>
          <div class="custom-controls">
            <label
              >Color de acento<input
                type="color"
                [disabled]="!canCustomize()"
                [ngModel]="store.preferences().accent"
                (ngModelChange)="setAccent($event)"
            /></label>
            <label
              >Primario<input
                type="color"
                [disabled]="!canCustomize()"
                [ngModel]="store.preferences().primary"
                (ngModelChange)="setThemeValue('primary', $event)"
            /></label>
            <label
              >Secundario<input
                type="color"
                [disabled]="!canCustomize()"
                [ngModel]="store.preferences().secondary"
                (ngModelChange)="setThemeValue('secondary', $event)"
            /></label>
            <label
              >Texto<input
                type="color"
                [disabled]="!canCustomize()"
                [ngModel]="store.preferences().text"
                (ngModelChange)="setThemeValue('text', $event)"
            /></label>
            <label
              >Superficie<input
                type="color"
                [disabled]="!canCustomize()"
                [ngModel]="store.preferences().surface"
                (ngModelChange)="setThemeValue('surface', $event)"
            /></label>
            <label
              >Bordes<input
                type="color"
                [disabled]="!canCustomize()"
                [ngModel]="store.preferences().border"
                (ngModelChange)="setThemeValue('border', $event)"
            /></label>
            <label
              >Densidad<select
                [disabled]="!canCustomize()"
                [ngModel]="store.preferences().density"
                (ngModelChange)="setDensity($event)"
              >
                <option value="comfortable">Cómoda</option>
                <option value="compact">Compacta</option>
              </select></label
            >
            <label
              >Redondeado
              <input
                type="range"
                min="4"
                max="24"
                [disabled]="!canCustomize()"
                [ngModel]="store.preferences().radius"
                (ngModelChange)="setRadius($event)"
              /><b>{{ store.preferences().radius }} px</b></label
            >
          </div>
          @if (!canCustomize()) {
            <p role="note">Tu acceso permite elegir presets, pero no personalizarlos.</p>
          }
          <section class="theme-preview" aria-label="Vista previa del tema">
            <div class="preview-nav"><b>◈ Finanzas</b><span>Dashboard</span><span>Movimientos</span></div>
            <div class="preview-body">
              <small>VISTA PREVIA</small>
              <h3>{{ store.preferences().name }}</h3>
              <div class="preview-kpis">
                <span><small>Balance</small><b>$12,4 M</b></span
                ><span><small>Gastos</small><b>$3,1 M</b></span>
              </div>
              <div class="preview-chart"><i></i><i></i><i></i><i></i></div>
              <button>Acción principal</button>
            </div>
          </section>
          <button type="button" [disabled]="!canCustomize()" (click)="saveCustomTheme()">
            Guardar tema personalizado
          </button>
        </article>
        <article>
          <h2>Tipografía e idioma</h2>
          <label
            >Tipografía<select
              [ngModel]="store.preferences().font"
              [disabled]="!can(P.preferencias.editar)"
              (ngModelChange)="setFont($event)"
            >
              @for (font of fonts; track font.value) {
                <option [value]="font.value">{{ font.label }}</option>
              }
            </select></label
          ><label
            >Idioma<select
              [ngModel]="store.preferences().locale"
              [disabled]="!can(P.preferencias.editar)"
              (ngModelChange)="setLocale($event)"
            >
              <option value="es-CO">Español (Colombia)</option>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="fr-FR">Français</option>
            </select></label
          >
        </article>
        <article>
          <h2>Datos locales</h2>
          <p>Doce meses, cientos de movimientos y relaciones reproducibles.</p>
          <button [disabled]="!can(P.preferencias.datos.eliminar)" (click)="store.reset()">
            Restaurar información inicial
          </button>
          <button (click)="logout()">Cerrar sesión</button>
        </article>
      </section></ng-template
    >
    @if (store.inspector(); as selected) {
      <demo-overlay
        [title]="inspectorTitle()"
        mode="inspector"
        [wide]="cardPaymentMode()"
        (closed)="store.inspector.set(null); cardPaymentMode.set(false)"
        ><ng-container *ngTemplateOutlet="inspector"></ng-container
      ></demo-overlay>
    }
    @if (store.form()?.kind === 'account') {
      <demo-account-form />
    }
    @if (['category', 'person', 'investment', 'recurrence'].includes(store.form()?.kind ?? '')) {
      <demo-management-form />
    }
    <ng-template #inspector
      ><section class="detail">
        <span class="amount">{{ inspectorAmount() }}</span>
        <p>{{ inspectorSubtitle() }}</p>
        <dl>
          @for (item of inspectorFacts(); track item[0]) {
            <div>
              <dt>{{ item[0] }}</dt>
              <dd>{{ item[1] }}</dd>
            </div>
          }
        </dl>
        @if (store.inspector()?.type === 'card' && !cardPaymentMode()) {
          <section class="statement">
            <header>
              <div>
                <span>EXTRACTO ESTIMADO</span>
                <h3>Próximo corte · día {{ selectedAccount()?.cutDay }}</h3>
              </div>
              <b>{{ store.money(cardStatementTotal()) }}</b>
            </header>
            <div>
              <span
                >Compras del ciclo <b>{{ store.money(cardStatementPurchases()) }}</b></span
              ><span
                >Cuotas del próximo mes <b>{{ store.money(nextInstallments()) }}</b></span
              ><span
                >Interés estimado <b>{{ store.money(cardEstimatedInterest()) }}</b></span
              ><span
                >Fecha límite <b>Día {{ selectedAccount()?.dueDay }}</b></span
              >
            </div>
            <small>Estimación basada en movimientos registrados; el extracto bancario puede variar.</small>
          </section>
        }
        <h3>Historial</h3>
        <ol>
          @for (h of store.history(); track $index) {
            <li>
              <b>{{ h.action }}</b
              ><span>{{ h.date }}</span>
            </li>
          }
        </ol>
        <footer>
          @if (store.inspector()?.type === 'movement') {
            @if (can(P.movimientos.editar)) {
              <button (click)="editSelected()">Editar</button>
            }
            @if (selectedMovement()?.person && can(P.personas.compras.crear)) {
              <button (click)="shareSelected()">Registrar compra compartida</button>
            }
            @if (can(P.movimientos.deshabilitar)) {
              <button class="danger-action" (click)="reverseSelected()">Reversar</button>
            }
          }
          @if (store.inspector()?.type === 'person' && can(P.personas.liquidaciones.crear)) {
            <button class="action" (click)="issueSelectedSettlement()">Generar liquidación</button>
          }
          @if (store.inspector()?.type === 'card' && !cardPaymentMode() && can(P.movimientos.pagos.crear)) {
            <button class="action" (click)="cardPaymentMode.set(true)">Registrar abono</button>
          }
          @if (store.inspector()?.type === 'account' && can(P.cuentas.deshabilitar)) {
            <button class="danger-action" (click)="deactivateSelectedAccount()">Desactivar cuenta</button>
          }
          @if (store.inspector()?.type === 'day') {
            @if (dayMoves(store.inspector()?.id ?? selectedCalendarDate()).length === 0) {
              <button disabled>Sin movimientos</button>
            }
          }
        </footer>
        @if (store.inspector()?.type === 'day') {
          <section class="day-movements">
            <h3>Movimientos del día</h3>
            @for (movement of dayMoves(store.inspector()?.id ?? selectedCalendarDate()); track movement.id) {
              <button (click)="openDayMovement(movement.id)">
                <span
                  >{{ movement.description
                  }}<small>{{ store.account(movement.accountId)?.name }} · {{ movement.category }}</small></span
                ><b>{{ store.money(movement.amount) }}</b>
              </button>
            } @empty {
              <p>No hay operaciones registradas en esta fecha.</p>
            }
          </section>
        }
        @if (store.inspector()?.type === 'movement' && calendarReturnDate()) {
          <button class="back-link" (click)="returnToCalendarDay()">← Volver a movimientos del día</button>
        }
        @if (store.inspector()?.type === 'card' && cardPaymentMode() && can(P.movimientos.pagos.crear)) {
          <section class="card-payment">
            <header>
              <div>
                <span>SIMULACIÓN DE ABONO</span>
                <h3>¿Cómo se aplicará el pago?</h3>
              </div>
              <button (click)="cardPaymentMode.set(false)">Volver</button>
            </header>
            <label
              >Valor del abono<input
                type="number"
                min="1"
                [ngModel]="cardPaymentAmount()"
                (ngModelChange)="cardPaymentAmount.set(+$event)"
            /></label>
            <div class="payment-summary">
              <span
                >Deuda antes <b>{{ store.money(cardDebt()) }}</b></span
              ><span
                >Abono distribuido <b>{{ store.money(appliedPayment()) }}</b></span
              ><span
                >Saldo estimado <b>{{ store.money(Math.max(0, cardDebt() - appliedPayment())) }}</b></span
              >
            </div>
            <div class="payment-table">
              <table>
                <thead>
                  <tr>
                    <th>Compra</th>
                    <th>Cuota</th>
                    <th>Saldo antes</th>
                    <th>Aplicación</th>
                    <th>Saldo después</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of paymentAllocation(); track row.id) {
                    <tr>
                      <td>{{ row.description }}</td>
                      <td>{{ row.installment }}</td>
                      <td>{{ store.money(row.before) }}</td>
                      <td>{{ store.money(row.applied) }}</td>
                      <td>{{ store.money(row.after) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <button class="action" (click)="confirmCardPayment()">Confirmar abono</button>
          </section>
        }
      </section></ng-template
    >
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .workspace-page {
        height: calc(100dvh - 112px);
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-height: 560px;
      }
      .page-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 18px;
        flex: none;
      }
      .page-head span,
      .scenario span {
        font-size: 0.65rem;
        color: var(--accent);
        font-weight: 750;
        letter-spacing: 0.1em;
      }
      .page-head h1 {
        font-family: var(--display);
        font-size: clamp(1.7rem, 2.6vw, 2.5rem);
        margin: 4px 0;
      }
      .page-head p {
        color: var(--muted);
        margin: 0;
        font-size: 0.84rem;
      }
      .head-actions button,
      .filters .quiet-reset {
        align-self: end;
        min-height: 40px;
        padding: 0 14px;
        border: 1px solid var(--control-line);
        border-radius: 9px;
        background: transparent;
        color: var(--muted);
        font-weight: 600;
      }
      .filters .quiet-reset:hover {
        color: var(--text);
        border-color: var(--accent);
      }
      .action {
        background: var(--accent);
        color: var(--accent-contrast);
        border: 1px solid var(--accent);
        border-radius: 9px;
        min-height: 40px;
        padding: 8px 13px;
      }
      .head-actions .secondary-action {
        background: var(--surface);
        color: var(--accent);
        box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 12%, transparent);
      }
      .filters-toggle {
        display: none;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 44px;
        margin-bottom: 10px;
        border: 1px solid var(--control-line);
        border-radius: 12px;
        background: var(--surface);
        font-weight: 600;
      }
      .filters-toggle i {
        display: inline-grid;
        place-items: center;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: 999px;
        background: var(--accent);
        color: var(--accent-contrast);
        font-style: normal;
        font-size: 0.75rem;
      }
      .filters {
        display: grid;
        grid-template-columns: minmax(190px, 1.35fr) repeat(5, minmax(120px, 0.75fr)) auto;
        gap: 10px;
        padding: 12px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
      }
      .filters label,
      .settings-grid label,
      .scenario label {
        display: flex;
        flex-direction: column;
        gap: 5px;
        color: var(--muted);
        font-size: 0.67rem;
      }
      .filters input,
      .filters select,
      .settings-grid select,
      .scenario input {
        height: 38px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text);
        padding: 0 11px;
      }
      .filters select,
      .account-tools select {
        appearance: none;
        padding-right: 32px;
        background-image:
          linear-gradient(45deg, transparent 50%, var(--muted) 50%),
          linear-gradient(135deg, var(--muted) 50%, transparent 50%);
        background-position:
          calc(100% - 15px) 50%,
          calc(100% - 10px) 50%;
        background-size: 5px 5px;
        background-repeat: no-repeat;
      }
      .filters input:focus,
      .filters select:focus,
      .account-tools input:focus,
      .account-tools select:focus {
        outline: 3px solid color-mix(in srgb, var(--accent) 18%, transparent);
        border-color: var(--accent);
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 12px;
      }
      .kpis.mini demo-kpi {
        padding: 13px;
      }
      .table-zone {
        flex: 1;
        min-height: 230px;
        display: flex;
      }
      .cards {
        display: flex;
        align-items: stretch;
        flex-wrap: wrap;
        gap: 12px;
        min-height: 142px;
        transition: min-height 0.2s;
      }
      .card-strip {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        flex: 1;
        min-width: 0;
        scroll-snap-type: x proximity;
        padding: 2px 2px 8px;
        scrollbar-width: thin;
      }
      .card-strip,
      .agenda,
      .payment-table {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .card-strip::-webkit-scrollbar,
      .agenda::-webkit-scrollbar,
      .payment-table::-webkit-scrollbar {
        display: none;
      }
      .card-strip .bank-card {
        flex: 0 0 230px;
        width: 230px;
        scroll-snap-align: start;
      }
      .card-strip .bank-card.active {
        outline: 3px solid color-mix(in srgb, var(--accent) 65%, transparent);
        outline-offset: 2px;
      }
      .card-pages {
        display: flex;
        align-items: center;
        gap: 7px;
        align-self: center;
      }
      .card-pages button,
      .back-link,
      .day-movements button,
      .card-payment header button {
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--text);
        border-radius: 8px;
        padding: 7px 10px;
      }
      .bank-card {
        width: min(230px, 24%);
        border: 0;
        border-radius: 16px;
        color: #fff;
        text-align: left;
        padding: 17px;
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--card-color) 95%, #fff),
          color-mix(in srgb, var(--card-color) 65%, #000)
        );
        display: grid;
        gap: 10px;
        box-shadow: 0 10px 20px #001b1520;
      }
      .bank-card span {
        font-size: 0.62rem;
        letter-spacing: 0.08em;
      }
      .bank-card b {
        font-size: 0.9rem;
      }
      .bank-card em {
        font-style: normal;
        letter-spacing: 0.1em;
      }
      .bank-card small {
        display: flex;
        justify-content: space-between;
        gap: 5px;
      }
      .compact-toggle {
        margin-left: auto;
        background: var(--surface);
        color: var(--text);
        border: 1px dashed var(--line);
        border-radius: 14px;
        padding: 12px;
      }
      .cards.compact {
        min-height: 70px;
      }
      .cards.compact .bank-card {
        width: 180px;
        display: flex;
        align-items: center;
        padding: 12px;
      }
      .cards.compact .bank-card span,
      .cards.compact .bank-card small {
        display: none;
      }
      .account-tools {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) minmax(170px, 240px) auto;
        align-items: end;
        gap: 10px;
        padding: 11px 12px;
        border: 1px solid var(--line);
        border-radius: 13px;
        background: var(--surface);
      }
      .account-tools label {
        display: grid;
        gap: 5px;
        color: var(--muted);
        font-size: 0.68rem;
      }
      .account-tools input,
      .account-tools select {
        width: 100%;
        height: 38px;
        border: 1px solid var(--line);
        border-radius: 9px;
        background-color: var(--canvas);
        color: var(--text);
        padding: 0 11px;
      }
      .account-tools > span {
        align-self: center;
        color: var(--muted);
        font-size: 0.72rem;
        white-space: nowrap;
      }
      .search-control {
        display: flex;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: var(--canvas);
        padding-left: 10px;
      }
      .search-control input {
        border: 0;
        background: transparent;
      }
      .search-control:focus-within {
        outline: 3px solid color-mix(in srgb, var(--accent) 18%, transparent);
        border-color: var(--accent);
      }
      .calendar-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 14px;
        min-height: 0;
        flex: 1;
      }
      .month,
      .agenda,
      .scenario > *,
      .chart,
      .settings-grid article,
      .notice-list article {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
      }
      .admin-flags,
      .audit-list {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 14px;
        display: grid;
        gap: 10px;
      }
      .admin-flags h2,
      .audit-list h2 {
        margin: 0;
        font-size: 1rem;
      }
      .admin-flags p,
      .audit-list p {
        margin: 0;
        color: var(--muted);
        font-size: 0.78rem;
      }
      .admin-flags label,
      .audit-list article {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-top: 1px solid var(--line);
        padding-top: 9px;
      }
      .admin-flags span {
        display: grid;
      }
      .admin-flags small,
      .audit-list span {
        color: var(--muted);
      }
      .audit-filters {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 220px));
        gap: 10px;
      }
      .audit-filters label {
        display: grid;
        gap: 5px;
        color: var(--muted);
        font-size: 0.72rem;
      }
      .audit-filters select {
        min-height: 36px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text);
        padding: 6px 9px;
      }
      .audit-list article em {
        color: var(--accent);
        font-style: normal;
        font-size: 0.7rem;
        font-weight: 700;
      }
      .audit-list article em.rejected {
        color: var(--danger);
      }
      .danger-action {
        color: var(--danger);
        border-color: color-mix(in srgb, var(--danger) 35%, var(--line)) !important;
      }
      .agenda .projected {
        border-left: 3px dashed var(--accent);
      }
      .month {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .month header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
      }
      .month header h2 {
        font-size: 1rem;
      }
      .month header button {
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--text);
        border-radius: 8px;
        padding: 7px 11px;
      }
      .calendar-toolbar {
        gap: 9px;
      }
      .calendar-title {
        display: grid;
        min-width: 170px;
      }
      .calendar-title span {
        color: var(--muted);
        font-size: 0.58rem;
        letter-spacing: 0.12em;
      }
      .calendar-title strong {
        text-transform: capitalize;
        font-family: var(--display);
        font-size: 1rem;
      }
      .calendar-toolbar .icon-button {
        width: 34px;
        height: 34px;
        padding: 0;
        border-radius: 50%;
      }
      .calendar-toolbar .today-button {
        color: var(--accent);
        border-color: color-mix(in srgb, var(--accent) 32%, var(--line));
      }
      .calendar-jump {
        display: flex;
        align-items: end;
        justify-content: center;
        gap: 8px;
      }
      .period-tabs {
        display: flex;
        padding: 3px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--canvas);
      }
      .period-tabs button {
        padding: 5px 10px !important;
        border: 0 !important;
      }
      .period-tabs button.active {
        background: var(--accent) !important;
        color: var(--accent-contrast);
      }
      .calendar-jump label,
      .report-toolbar label {
        display: grid;
        gap: 3px;
        color: var(--muted);
        font-size: 0.62rem;
      }
      .calendar-jump select,
      .calendar-jump input,
      .report-toolbar select {
        min-height: 34px;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 4px 8px;
        color: var(--text);
        background: var(--surface);
      }
      .week {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
      }
      .names {
        padding: 8px 0;
        border-block: 1px solid var(--line);
      }
      .names b {
        text-align: center;
        font-size: 0.66rem;
        color: var(--muted);
      }
      .grid {
        flex: 1;
        grid-auto-rows: 1fr;
        min-height: 0;
      }
      .grid.week-view {
        grid-auto-rows: 1fr;
      }
      .grid.day-view {
        grid-template-columns: 1fr;
      }
      .grid.day-view button {
        padding: 18px;
      }
      .grid.day-view button span {
        padding: 7px 9px;
        border-radius: 7px;
        background: color-mix(in srgb, var(--danger) 8%, transparent);
      }
      .year-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        padding: 14px;
        flex: 1;
      }
      .year-grid button {
        display: grid;
        place-content: center;
        gap: 4px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--canvas);
        color: var(--text);
        text-transform: capitalize;
      }
      .year-grid button:hover {
        border-color: var(--accent);
        background: var(--accent-soft);
        transform: translateY(-1px);
      }
      .year-grid button b {
        font-size: 1.25rem;
        color: var(--accent);
      }
      .year-grid button small {
        color: var(--muted);
      }
      .grid button {
        min-height: 74px;
        background: var(--surface);
        color: var(--text);
        border: 0;
        border-right: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
        padding: 7px;
        text-align: left;
        overflow: hidden;
      }
      .grid button.selected {
        box-shadow: inset 0 0 0 2px var(--accent);
      }
      .grid button.outside {
        opacity: 0.48;
      }
      .grid button b {
        display: block;
      }
      .grid button span,
      .grid button em {
        display: block;
        font-size: 0.62rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--danger);
        margin-top: 5px;
      }
      .grid button span.income {
        color: var(--success);
      }
      .grid button em {
        color: var(--accent);
        font-style: normal;
      }
      .agenda {
        padding: 18px;
        overflow: auto;
      }
      .agenda h3 {
        margin-top: 0;
      }
      .agenda button {
        width: 100%;
        border: 0;
        border-bottom: 1px solid var(--line);
        background: transparent;
        color: var(--text);
        display: flex;
        justify-content: space-between;
        text-align: left;
        padding: 12px 0;
        font-size: 0.72rem;
      }
      .agenda button b {
        color: var(--danger);
      }
      .tabs {
        display: flex;
        gap: 5px;
        border-bottom: 1px solid var(--line);
      }
      .tabs button {
        border: 0;
        background: transparent;
        color: var(--muted);
        padding: 10px 14px;
      }
      .tabs .active {
        color: var(--accent);
        border-bottom: 2px solid var(--accent);
      }
      .scenario-planner {
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        gap: 14px;
        flex: 1;
        min-height: 0;
      }
      .planner-controls,
      .projection-card,
      .planner-kpis article {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
      }
      .planner-controls {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .planner-controls header h2,
      .projection-card h2 {
        margin: 4px 0 6px;
        font-size: 1.05rem;
      }
      .planner-controls header p,
      .projection-card header p {
        margin: 0;
        color: var(--muted);
        font-size: 0.76rem;
        line-height: 1.5;
      }
      .planner-controls label {
        display: grid;
        gap: 8px;
        color: var(--muted);
        font-size: 0.72rem;
      }
      .planner-controls label b {
        font-size: 1.25rem;
        color: var(--text);
      }
      .planner-controls label small {
        line-height: 1.4;
      }
      .planner-controls input[type='date'] {
        min-height: 40px;
        border: 1px solid var(--line);
        border-radius: 9px;
        padding: 6px 10px;
        color: var(--text);
        background: var(--surface);
      }
      .planner-controls input[type='range'] {
        accent-color: var(--accent);
      }
      .planner-note {
        display: grid;
        gap: 5px;
        padding: 12px;
        border-radius: 10px;
        background: var(--accent-soft);
        font-size: 0.72rem;
        line-height: 1.45;
      }
      .planner-note span {
        color: var(--muted);
        letter-spacing: normal;
        font-weight: 400;
      }
      .planner-results {
        min-width: 0;
        display: grid;
        grid-template-rows: auto minmax(320px, 1fr) auto;
        gap: 12px;
      }
      .planner-kpis {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .planner-kpis article {
        padding: 14px;
        display: grid;
        gap: 5px;
        min-width: 0;
      }
      .planner-kpis strong {
        font-size: 1.2rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .planner-kpis small {
        color: var(--muted);
      }
      .projection-card {
        padding: 18px;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .projection-card > header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 18px;
      }
      .chart-legend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 13px;
        font-size: 0.7rem;
        color: var(--muted);
      }
      .chart-legend span::before {
        content: '';
        display: inline-block;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        margin-right: 6px;
        background: var(--accent);
      }
      .chart-legend .current-key::before,
      .chart-legend .expense-key::before {
        background: var(--danger);
      }
      .projection-plot {
        flex: 1;
        min-height: 220px;
        display: grid;
        grid-template-columns: 62px minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) 24px;
        margin-top: 15px;
      }
      .projection-plot svg {
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .projection-plot polyline,
      .report-line polyline {
        fill: none;
        stroke: var(--accent);
        stroke-width: 3;
        vector-effect: non-scaling-stroke;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .projection-plot .current-line {
        stroke: var(--danger);
        stroke-dasharray: 7 5;
      }
      .grid-lines line {
        stroke: var(--line);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .y-labels {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: end;
        padding: 2px 9px 4px 0;
        color: var(--muted);
        font-size: 0.62rem;
      }
      .x-labels {
        grid-column: 2;
        display: flex;
        justify-content: space-between;
        color: var(--muted);
        font-size: 0.62rem;
      }
      .planner-disclaimer,
      .chart-unit {
        margin: 0;
        color: var(--muted);
        font-size: 0.66rem;
      }
      .scenario {
        display: grid;
        grid-template-columns: 240px 1fr 1fr;
        gap: 14px;
        flex: 1;
        min-height: 0;
      }
      .scenario > * {
        padding: 20px;
        min-width: 0;
      }
      .scenario aside {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .scenario label b {
        font-size: 1.1rem;
        color: var(--text);
      }
      .scenario h2 {
        font-size: 1.2rem;
      }
      .proposed {
        border-color: var(--accent) !important;
      }
      .line-chart {
        height: 210px;
        background:
          linear-gradient(170deg, transparent 45%, var(--accent) 46%, var(--accent) 48%, transparent 49%),
          repeating-linear-gradient(0deg, var(--line) 0 1px, transparent 1px 50px);
        position: relative;
      }
      .danger {
        background:
          linear-gradient(15deg, transparent 45%, var(--danger) 46%, var(--danger) 48%, transparent 49%),
          repeating-linear-gradient(0deg, var(--line) 0 1px, transparent 1px 50px);
      }
      .report-grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 14px;
        overflow: auto;
      }
      .report-toolbar {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius, 14px);
      }
      .report-toolbar p {
        margin: 0;
        color: var(--muted);
        font-size: 0.72rem;
      }
      .report-facts {
        display: grid;
        gap: 12px;
      }
      .report-facts div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--line);
      }
      .report-facts dt {
        color: var(--muted);
      }
      .report-facts dd {
        margin: 0;
        font-weight: 700;
      }
      .insights {
        display: grid;
        gap: 12px;
        color: var(--muted);
      }
      .chart {
        padding: 20px;
        min-height: 250px;
      }
      .chart h2 {
        font-size: 1rem;
      }
      .chart.full {
        grid-column: 1/-1;
      }
      .chart > h2 {
        margin: 0 0 5px;
      }
      .chart-description {
        color: var(--muted);
        margin: 0 0 12px;
        font-size: 0.72rem;
      }
      .paired-bars {
        height: 190px;
        display: flex;
        align-items: stretch;
        gap: 12px;
        padding: 28px 8px 0;
        border-bottom: 1px solid var(--line);
      }
      .paired-bars > div {
        flex: 1;
        min-width: 34px;
        display: grid;
        grid-template-rows: 1fr 22px;
        gap: 5px;
        text-align: center;
      }
      .paired-bars b {
        color: var(--muted);
        font-size: 0.65rem;
      }
      .pair {
        display: flex;
        align-items: end;
        justify-content: center;
        gap: 5px;
        height: 100%;
      }
      .pair i {
        position: relative;
        width: min(18px, 40%);
        min-height: 2px;
        border-radius: 5px 5px 0 0;
        background: var(--accent);
      }
      .pair i:nth-child(2) {
        background: var(--danger);
      }
      .pair em {
        position: absolute;
        left: 50%;
        top: -22px;
        transform: translateX(-50%);
        color: var(--muted);
        font-size: 0.56rem;
        font-style: normal;
        white-space: nowrap;
      }
      .category-report {
        display: grid;
        grid-template-columns: minmax(145px, 0.8fr) 1.2fr;
        align-items: center;
        gap: 12px;
      }
      .category-report ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 8px;
      }
      .category-report li {
        display: grid;
        grid-template-columns: 9px 1fr auto;
        align-items: center;
        gap: 7px;
        font-size: 0.68rem;
      }
      .category-report li i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .category-report li b {
        font-size: 0.64rem;
        white-space: nowrap;
      }
      .report-line {
        display: grid;
        grid-template-columns: 70px minmax(0, 1fr);
        grid-template-rows: 170px auto;
        min-height: 205px;
      }
      .report-line .axis-y {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: end;
        padding: 3px 10px 7px 0;
        color: var(--muted);
        font-size: 0.6rem;
        letter-spacing: normal;
      }
      .report-line .axis-y em {
        font-style: normal;
      }
      .report-line svg {
        width: 100%;
        height: 160px;
        overflow: visible;
      }
      .report-line .zero {
        stroke: var(--line);
        stroke-dasharray: 5 4;
        vector-effect: non-scaling-stroke;
      }
      .report-line .axis-x {
        grid-column: 2;
        display: flex;
        justify-content: space-between;
        gap: 4px;
        color: var(--muted);
        font-size: 0.62rem;
      }
      .report-line .axis-x span {
        display: grid;
        text-align: center;
        gap: 2px;
      }
      .report-line .axis-x small {
        color: var(--text);
        font-size: 0.56rem;
      }
      .bars {
        height: 180px;
        display: flex;
        align-items: end;
        gap: 8%;
        border-bottom: 1px solid var(--line);
      }
      .bars i {
        width: 8%;
        background: var(--accent);
        border-radius: 6px 6px 0 0;
      }
      .bars i span {
        display: block;
        height: 65%;
        background: var(--danger);
        transform: translateX(55%);
      }
      .donut {
        margin: 30px auto;
        width: 170px;
        height: 170px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle, var(--surface) 0 46%, transparent 47%),
          conic-gradient(var(--accent) 0 35%, var(--danger) 35% 58%, #d3a34a 58% 78%, var(--line) 78%);
      }
      .trend {
        height: 220px;
        background:
          linear-gradient(170deg, transparent 45%, var(--accent) 46%, var(--accent) 48%, transparent 49%),
          repeating-linear-gradient(0deg, var(--line) 0 1px, transparent 1px 50px);
      }
      .notice-list {
        display: grid;
        gap: 10px;
        overflow: auto;
      }
      .notice-list article {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 17px;
      }
      .notice-list article.unread {
        border-left: 4px solid var(--accent);
      }
      .notice-list h2 {
        font-size: 0.9rem;
        margin: 0;
      }
      .notice-list p {
        font-size: 0.75rem;
        color: var(--muted);
        margin: 5px 0;
      }
      .notice-list button {
        margin-left: auto;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--text);
        border-radius: 8px;
        padding: 9px;
      }
      .settings-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        overflow: auto;
      }
      .settings-grid article {
        padding: 22px;
      }
      .settings-grid .wide {
        grid-column: 1 / -1;
      }
      .settings-grid h2 {
        font-size: 1rem;
      }
      .settings-grid p {
        color: var(--muted);
        font-size: 0.8rem;
      }
      .theme-preview {
        margin-top: 18px;
        min-height: 230px;
        display: grid;
        grid-template-columns: 150px 1fr;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        overflow: hidden;
        background: var(--bg);
        color: var(--text);
      }
      .preview-nav {
        background: var(--nav);
        padding: 16px;
        display: grid;
        align-content: start;
        gap: 15px;
        font-size: 0.75rem;
      }
      .preview-body {
        padding: 18px;
      }
      .preview-body h3 {
        margin: 4px 0 14px;
      }
      .preview-kpis {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .preview-kpis span {
        display: grid;
        padding: 10px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
      }
      .preview-chart {
        height: 70px;
        display: flex;
        gap: 8px;
        align-items: end;
        margin: 12px 0;
      }
      .preview-chart i {
        flex: 1;
        height: 35%;
        border-radius: 5px 5px 0 0;
        background: var(--accent);
      }
      .preview-chart i:nth-child(2) {
        height: 70%;
        background: var(--danger);
      }
      .preview-chart i:nth-child(3) {
        height: 50%;
      }
      .preview-chart i:nth-child(4) {
        height: 85%;
        background: var(--danger);
      }
      .preview-body button {
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
      }
      .settings-grid label {
        margin-top: 14px;
      }
      .settings-grid button {
        border: 1px solid var(--line);
        border-radius: 9px;
        background: var(--surface);
        color: var(--text);
        padding: 11px;
      }
      .theme-picks {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .theme-picks button {
        display: grid;
        gap: 8px;
      }
      .theme-picks i {
        width: 100px;
        height: 45px;
        border-radius: 7px;
      }
      .theme-picks button[aria-pressed='true'] {
        border-color: var(--accent);
        box-shadow: 0 0 0 2px var(--accent-soft);
      }
      .custom-controls {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 18px;
      }
      .custom-controls input[type='color'] {
        width: 100%;
        min-height: 40px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
      }
      .theme-picks .light {
        background: #fff;
        border: 1px solid #ccd;
      }
      .theme-picks .dark {
        background: #082a30;
      }
      .detail > .amount {
        font-size: 2rem;
        font-weight: 700;
        color: var(--accent);
      }
      .detail > p {
        color: var(--muted);
      }
      dl div {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid var(--line);
      }
      dt {
        color: var(--muted);
        font-size: 0.75rem;
      }
      dd {
        margin: 0;
        font-weight: 600;
      }
      ol {
        list-style: none;
        padding: 0;
      }
      ol li {
        border-left: 2px solid var(--accent);
        padding: 4px 0 15px 14px;
        display: flex;
        justify-content: space-between;
      }
      ol span {
        color: var(--muted);
        font-size: 0.72rem;
      }
      .detail footer {
        display: flex;
        gap: 9px;
        margin-top: 22px;
      }
      .detail footer button {
        flex: 1;
        min-height: 42px;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: var(--surface);
        color: var(--text);
      }
      .day-movements {
        display: grid;
        gap: 8px;
        margin-top: 16px;
      }
      .day-movements button {
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-align: left;
      }
      .day-movements span {
        display: grid;
        gap: 3px;
      }
      .day-movements small {
        color: var(--muted);
      }
      .back-link {
        margin-top: 12px;
      }
      .card-payment {
        display: grid;
        gap: 16px;
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
      }
      .card-payment header,
      .payment-summary {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .card-payment h3 {
        margin: 4px 0 0;
      }
      .card-payment label {
        display: grid;
        gap: 6px;
        color: var(--muted);
      }
      .card-payment input {
        min-height: 40px;
        border: 1px solid var(--line);
        border-radius: 9px;
        padding: 8px 11px;
        background: var(--surface);
        color: var(--text);
      }
      .payment-summary span {
        display: grid;
        gap: 5px;
        flex: 1;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        color: var(--muted);
      }
      .payment-summary b {
        color: var(--text);
      }
      .payment-table {
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      .payment-table table {
        width: 100%;
        border-collapse: collapse;
      }
      .payment-table th,
      .payment-table td {
        padding: 10px;
        border-bottom: 1px solid var(--line);
        text-align: right;
        white-space: nowrap;
      }
      .payment-table th:first-child,
      .payment-table td:first-child {
        text-align: left;
      }
      .statement {
        display: grid;
        gap: 12px;
        padding: 14px;
        margin: 16px 0;
        border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--line));
        border-radius: 12px;
        background: var(--accent-soft);
      }
      .statement header,
      .statement div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .statement h3 {
        margin: 3px 0 0;
      }
      .statement div span {
        display: grid;
        gap: 3px;
        font-size: 0.72rem;
        color: var(--muted);
      }
      .statement div b {
        color: var(--text);
      }
      .statement small {
        color: var(--muted);
      }
      @media (max-width: 1500px) {
        .filters {
          grid-template-columns: repeat(4, minmax(130px, 1fr));
        }
      }
      @media (max-width: 1100px) {
        .kpis {
          grid-template-columns: repeat(2, 1fr);
        }
        .calendar-layout {
          grid-template-columns: 1fr 260px;
        }
        .scenario {
          grid-template-columns: 1fr 1fr;
        }
        .scenario aside {
          grid-column: 1/-1;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .scenario-planner {
          grid-template-columns: 1fr;
        }
        .planner-controls {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          align-items: start;
        }
        .planner-note {
          grid-column: 1/-1;
        }
        .bank-card {
          min-width: 190px;
        }
        .cards {
          overflow: auto;
        }
      }
      @media (max-width: 700px) {
        .filters-toggle {
          display: flex;
        }
        .filters.collapsed {
          display: none;
        }
        .workspace-page {
          height: auto;
          min-height: calc(100dvh - 100px);
        }
        .filters {
          grid-template-columns: 1fr;
        }
        .account-tools {
          grid-template-columns: 1fr;
        }
        .calendar-toolbar {
          flex-wrap: wrap;
        }
        .calendar-title {
          order: -1;
          width: 100%;
        }
        .period-tabs {
          order: 3;
          width: 100%;
        }
        .period-tabs button {
          flex: 1;
        }
        .year-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .kpis {
          grid-template-columns: 1fr 1fr;
        }
        .table-zone {
          height: 520px;
          flex: none;
        }
        .cards {
          overflow: auto;
        }
        .calendar-layout {
          display: block;
        }
        .calendar-jump label:last-child {
          display: none;
        }
        .month {
          height: 560px;
        }
        .agenda {
          margin-top: 14px;
        }
        .scenario {
          display: block;
          min-width: 0;
        }
        .planner-controls {
          display: flex;
        }
        .planner-kpis {
          grid-template-columns: 1fr;
        }
        .projection-card > header {
          display: grid;
        }
        .projection-plot {
          grid-template-columns: 48px minmax(0, 1fr);
        }
        .category-report {
          grid-template-columns: 1fr;
        }
        .paired-bars {
          overflow-x: auto;
        }
        .paired-bars > div {
          flex: 0 0 54px;
        }
        .tabs {
          max-width: 100%;
          overflow-x: auto;
        }
        .tabs button {
          flex: 0 0 auto;
        }
        .scenario > * {
          margin-bottom: 12px;
        }
        .scenario input {
          max-width: 100%;
        }
        .report-grid,
        .settings-grid {
          grid-template-columns: 1fr;
        }
        .custom-controls {
          grid-template-columns: 1fr;
        }
        .settings-grid .wide {
          grid-column: auto;
        }
        .chart.full {
          grid-column: auto;
        }
        .page-head {
          align-items: start;
        }
        .page-head p {
          display: none;
        }
      }
    `,
  ],
})
export class WorkspaceComponent implements AfterViewInit {
  readonly Math = Math;
  readonly store = inject(DemoStore);
  private readonly capabilities = inject(CAPABILITIES);
  readonly P = P;
  /** Reactivo: el sondeo de sesion cambia permisos y la interfaz debe seguirlo. */
  readonly canCustomize = computed(() => this.capabilities.allows(P.preferencias.tema.editar));
  /** Comprobacion puntual desde plantilla. */
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(FinanceApiClient);
  private movementRequest = 0;
  readonly projectedOccurrences = signal<readonly ApiProjectedOccurrence[]>([]);
  readonly auditEvents = signal<readonly ApiAuditEvent[]>([]);
  readonly auditActor = signal('all');
  readonly auditModule = signal('all');
  readonly demoAuditEvents = computed<readonly DemoAuditEvent[]>(() => this.store.data().auditEvents);
  readonly normalizedAuditEvents = computed<readonly DemoAuditEvent[]>(() =>
    this.store.runtime.mode === 'demo'
      ? this.demoAuditEvents()
      : this.auditEvents().map((event) => ({
          id: event.id,
          createdAt: event.createdAt,
          actor: 'Usuario autenticado',
          action: event.action,
          module: event.entityType,
          entityType: event.entityType,
          entityId: event.entityId ?? '',
          result: 'Exitoso',
        })),
  );
  readonly auditActors = computed(() => [...new Set(this.normalizedAuditEvents().map((event) => event.actor))]);
  readonly auditModules = computed(() => [...new Set(this.normalizedAuditEvents().map((event) => event.module))]);
  readonly visibleAuditEvents = computed(() =>
    this.normalizedAuditEvents().filter(
      (event) =>
        (this.auditActor() === 'all' || event.actor === this.auditActor()) &&
        (this.auditModule() === 'all' || event.module === this.auditModule()),
    ),
  );
  readonly recurrences = signal<readonly ApiRecurrence[]>([]);
  readonly featureFlagRows = computed(() =>
    Object.entries(this.store.featureFlags()).map(([key, enabled]) => ({ key, enabled })),
  );
  readonly page = computed(() => this.route.snapshot.url[0]?.path ?? 'movements');
  readonly meta = computed(() => labels[this.page()] ?? labels['movements']);
  readonly compactCards = signal(false);
  readonly movementAccountType = signal<'all' | 'savings' | 'credit' | 'cash'>('all');
  readonly movementCategory = signal('all');
  readonly movementOperation = signal('all');
  readonly movementCategories = computed(() => [...new Set(this.store.data().movements.map((m) => m.category))].sort());
  readonly accountQuery = signal('');
  readonly accountType = signal<'all' | 'savings' | 'credit' | 'cash'>('all');
  readonly filteredAccounts = computed(() => {
    const query = this.accountQuery().trim().toLocaleLowerCase('es');
    const type = this.accountType();
    return this.store
      .data()
      .accounts.filter(
        (account) =>
          (type === 'all' || account.type === type) &&
          (!query ||
            account.name.toLocaleLowerCase('es').includes(query) ||
            (account.lastFour ?? '').toLocaleLowerCase('es').includes(query)),
      );
  });
  readonly accountPage = signal(0);
  readonly accountPageSize = 6;
  readonly accountPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredAccounts().length / this.accountPageSize)),
  );
  readonly visibleAccounts = computed(() =>
    this.filteredAccounts().slice(
      this.accountPage() * this.accountPageSize,
      (this.accountPage() + 1) * this.accountPageSize,
    ),
  );
  readonly selectedAccountFilter = signal('all');
  readonly accountMovementRows = computed(() =>
    this.movementRows().filter(
      (row) => this.selectedAccountFilter() === 'all' || row['raw']?.accountId === this.selectedAccountFilter(),
    ),
  );
  readonly calendarViews = [
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'year', label: 'Año' },
  ] as const;
  readonly calendarView = signal<'day' | 'week' | 'month' | 'year'>('month');
  readonly calendarReturnDate = signal<string | null>(null);
  readonly cardPaymentMode = signal(false);
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
  readonly cardEstimatedInterest = computed(() => Math.round(this.cardDebt() * 0.023));
  readonly cardStatementTotal = computed(() => Math.round(this.nextInstallments() + this.cardEstimatedInterest()));
  readonly planningTabs = ['Deudas', 'Compra', 'Vacaciones', 'Inversión'] as const;
  readonly planningTab = signal<(typeof this.planningTabs)[number]>('Deudas');
  readonly monthly = signal(1200000);
  targetDate = '2027-08-31';
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  readonly currentMonths = computed(() => Math.max(1, Math.ceil(this.store.debt() / 650000)));
  readonly proposedMonths = computed(() => Math.max(1, Math.ceil(this.store.debt() / Math.max(1, this.monthly()))));
  readonly currentInterest = computed(() => Math.round(this.store.debt() * 0.018 * this.currentMonths()));
  readonly proposedInterest = computed(() => Math.round(this.store.debt() * 0.018 * this.proposedMonths()));
  readonly estimatedSavings = computed(() => Math.max(0, this.currentInterest() - this.proposedInterest()));
  compactMoney(value: number): string {
    return new Intl.NumberFormat(this.store.preferences().locale, {
      style: 'currency',
      currency: 'COP',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  readonly planningCopy = computed(() => {
    switch (this.planningTab()) {
      case 'Compra':
        return {
          parameterTitle: 'Simular una compra',
          amountLabel: 'Valor de la compra',
          helper: 'Mide el impacto de una compra sobre tu liquidez durante los próximos doce meses.',
          rangeHint: 'Incluye el valor total que quieres financiar o pagar.',
          assumption: 'Distribución lineal del impacto, sin nuevas compras ni cambios de ingreso.',
          chartTitle: 'Liquidez disponible después de la compra',
          chartDescription: 'Saldo disponible estimado, comparando no comprar frente a realizar la compra.',
          min: 100000,
          max: 10000000,
          step: 100000,
          currentLabel: 'Sin la compra',
          proposedLabel: 'Con la compra',
        };
      case 'Vacaciones':
        return {
          parameterTitle: 'Plan de vacaciones',
          amountLabel: 'Aporte mensual',
          helper: 'Comprueba cuánto acumularías separando una cantidad fija cada mes.',
          rangeHint: 'El aporte se descuenta de la liquidez mensual disponible.',
          assumption: 'Doce aportes iguales, sin rentabilidad y sin retiros anticipados.',
          chartTitle: 'Ahorro acumulado para el viaje',
          chartDescription: 'Capital reservado mes a mes, comparando el ahorro actual con el plan propuesto.',
          min: 100000,
          max: 5000000,
          step: 100000,
          currentLabel: 'Ahorro actual',
          proposedLabel: 'Plan mensual',
        };
      case 'Inversión':
        return {
          parameterTitle: 'Simular inversión',
          amountLabel: 'Capital a invertir',
          helper: 'Explora un escenario de rentabilidad sin afectar el patrimonio registrado.',
          rangeHint: 'Capital inicial aplicado una sola vez.',
          assumption: 'Rentabilidad anual supuesta del 10 %, compuesta mensualmente; no incluye impuestos.',
          chartTitle: 'Valor proyectado de la inversión',
          chartDescription: 'Evolución estimada del capital sin invertir frente al escenario invertido.',
          min: 100000,
          max: 10000000,
          step: 100000,
          currentLabel: 'Capital disponible',
          proposedLabel: 'Proyección a 12 meses',
        };
      default:
        return {
          parameterTitle: 'Plan de deuda',
          amountLabel: 'Abono mensual',
          helper: 'Compara el ritmo actual de pago con un abono mensual mayor.',
          rangeHint: 'El cálculo distribuye el pago sobre el saldo total registrado.',
          assumption: 'Tasa mensual estimada de 1,8 % y ausencia de nuevas compras.',
          chartTitle: 'Saldo de deuda pendiente',
          chartDescription: 'Reducción estimada del saldo durante doce meses con el pago actual y el propuesto.',
          min: 100000,
          max: 5000000,
          step: 50000,
          currentLabel: 'Ritmo actual',
          proposedLabel: 'Con el abono propuesto',
        };
    }
  });
  readonly planningCurrent = computed(() => {
    switch (this.planningTab()) {
      case 'Compra':
        return {
          headline: this.store.money(this.store.available()),
          detail: 'Disponible antes de realizar la compra.',
        };
      case 'Vacaciones':
        return {
          headline: this.store.money(this.store.available()),
          detail: 'Liquidez disponible sin separar un ahorro mensual.',
        };
      case 'Inversión':
        return {
          headline: this.store.money(this.investmentValue()),
          detail: 'Valor estimado de las inversiones registradas.',
        };
      default:
        return {
          headline: `${this.currentMonths()} meses`,
          detail: `${this.store.money(this.currentInterest())} de intereses estimados al ritmo actual.`,
        };
    }
  });
  readonly planningProposed = computed(() => {
    switch (this.planningTab()) {
      case 'Compra':
        return {
          headline: this.store.money(this.store.available() - this.monthly()),
          detail: 'Disponible estimado después de la compra simulada.',
        };
      case 'Vacaciones':
        return {
          headline: this.store.money(this.monthly() * 12),
          detail: 'Ahorro acumulado en doce meses con el aporte seleccionado.',
        };
      case 'Inversión':
        return {
          headline: this.store.money(Math.round(this.monthly() * 1.1)),
          detail: 'Proyección ilustrativa a un año con una rentabilidad supuesta del 10 %.',
        };
      default:
        return {
          headline: `${this.proposedMonths()} meses`,
          detail: `Ahorrarías aproximadamente ${this.store.money(this.estimatedSavings())} en intereses.`,
        };
    }
  });
  readonly planningSeries = computed(() => {
    const amount = this.monthly();
    const available = Math.max(0, this.store.available());
    const debt = Math.max(0, this.store.debt());
    const investment = Math.max(0, this.investmentValue());
    return Array.from({ length: 13 }, (_, month) => {
      switch (this.planningTab()) {
        case 'Compra':
          return { current: available, proposed: Math.max(0, available - amount - month * amount * 0.01) };
        case 'Vacaciones':
          return { current: 0, proposed: amount * month };
        case 'Inversión':
          return { current: investment + amount, proposed: investment + amount * Math.pow(1.1, month / 12) };
        default:
          return {
            current: Math.max(0, debt - month * 650000),
            proposed: Math.max(0, debt - month * amount),
          };
      }
    });
  });
  readonly planningChartMax = computed(() =>
    Math.max(1, ...this.planningSeries().flatMap((point) => [point.current, point.proposed])),
  );
  readonly planningCurrentPoints = computed(() =>
    this.chartPoints(
      this.planningSeries().map((point) => point.current),
      this.planningChartMax(),
      600,
      220,
    ),
  );
  readonly planningProposedPoints = computed(() =>
    this.chartPoints(
      this.planningSeries().map((point) => point.proposed),
      this.planningChartMax(),
      600,
      220,
    ),
  );
  readonly planningMetrics = computed(() => {
    const current = this.planningCurrent();
    const proposed = this.planningProposed();
    switch (this.planningTab()) {
      case 'Compra':
        return [
          { label: 'Disponible actual', value: current.headline, hint: 'Antes de comprar' },
          { label: 'Disponible estimado', value: proposed.headline, hint: 'Después de comprar' },
          { label: 'Impacto inmediato', value: this.store.money(this.monthly()), hint: 'Valor simulado' },
        ];
      case 'Vacaciones':
        return [
          { label: 'Aporte mensual', value: this.store.money(this.monthly()), hint: 'Durante 12 meses' },
          { label: 'Meta acumulada', value: proposed.headline, hint: 'Sin rendimientos' },
          {
            label: 'Esfuerzo sobre liquidez',
            value: `${Math.round((this.monthly() / Math.max(1, this.store.available())) * 100)} %`,
            hint: 'Del disponible actual',
          },
        ];
      case 'Inversión':
        return [
          { label: 'Capital inicial', value: this.store.money(this.monthly()), hint: 'Aporte simulado' },
          { label: 'Valor a 12 meses', value: proposed.headline, hint: 'Rentabilidad supuesta: 10 %' },
          {
            label: 'Ganancia estimada',
            value: this.store.money(Math.round(this.monthly() * 0.1)),
            hint: 'Antes de impuestos',
          },
        ];
      default:
        return [
          { label: 'Plazo actual', value: current.headline, hint: 'Pagando $650 mil/mes' },
          { label: 'Nuevo plazo', value: proposed.headline, hint: `Pagando ${this.compactMoney(this.monthly())}/mes` },
          {
            label: 'Intereses evitados',
            value: this.store.money(this.estimatedSavings()),
            hint: 'Estimación acumulada',
          },
        ];
    }
  });
  readonly week = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly calendarYear = signal(2026);
  readonly calendarMonth = signal(7);
  readonly selectedCalendarDate = signal('2026-08-18');
  readonly calendarMonths = Array.from({ length: 12 }, (_, value) => ({
    value,
    label: new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(Date.UTC(2026, value, 1))),
  }));
  readonly calendarDays = computed(() => {
    const year = this.calendarYear();
    const month = this.calendarMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(Date.UTC(year, month, index - offset + 1));
      const iso = date.toISOString().slice(0, 10);
      return {
        iso,
        day: date.getUTCDate(),
        current: date.getUTCMonth() === month,
        label: new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeZone: 'UTC' }).format(date),
      };
    });
  });
  readonly visibleCalendarDays = computed(() => {
    const view = this.calendarView();
    const days = this.calendarDays();
    if (view === 'month') return days;
    const selected = this.selectedCalendarDate();
    const selectedIndex = Math.max(
      0,
      days.findIndex((day) => day.iso === selected),
    );
    if (view === 'day') return days.slice(selectedIndex, selectedIndex + 1);
    const weekStart = Math.floor(selectedIndex / 7) * 7;
    return days.slice(weekStart, weekStart + 7);
  });
  readonly calendarTitle = computed(() => {
    const date = new Date(`${this.selectedCalendarDate()}T00:00:00Z`);
    const view = this.calendarView();
    if (view === 'year') return String(this.calendarYear());
    if (view === 'day') return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
    if (view === 'week') {
      const days = this.visibleCalendarDays();
      return days.length
        ? `${days[0].day}–${days.at(-1)?.day} de ${this.calendarMonths[this.calendarMonth()].label}`
        : '';
    }
    return `${this.calendarMonths[this.calendarMonth()].label} ${this.calendarYear()}`;
  });
  readonly months = [
    { value: '2026-08', label: 'Agosto 2026' },
    { value: '2026-07', label: 'Julio 2026' },
    { value: '2026-06', label: 'Junio 2026' },
    { value: '2026-05', label: 'Mayo 2026' },
  ];
  readonly reportPeriod = signal('6');
  readonly reportMovements = computed(() => {
    const periods = [...new Set(this.store.data().movements.map((movement) => movement.date.slice(0, 7)))]
      .sort()
      .slice(-Number(this.reportPeriod()));
    return this.store.data().movements.filter((movement) => periods.includes(movement.date.slice(0, 7)));
  });
  readonly reportIncome = computed(() =>
    this.reportMovements()
      .filter((movement) => movement.amount > 0)
      .reduce((sum, movement) => sum + movement.amount, 0),
  );
  readonly reportExpenses = computed(
    () =>
      -this.reportMovements()
        .filter((movement) => movement.amount < 0)
        .reduce((sum, movement) => sum + movement.amount, 0),
  );
  readonly reportNet = computed(() => this.reportIncome() - this.reportExpenses());
  readonly reportSavingsRate = computed(() =>
    this.reportIncome() ? `${Math.round((this.reportNet() / this.reportIncome()) * 100)} %` : '0 %',
  );
  readonly reportAverageExpense = computed(() => this.reportExpenses() / Number(this.reportPeriod()));
  readonly reportSeries = computed(() => {
    const grouped = new Map<string, { income: number; expense: number }>();
    for (const movement of this.reportMovements()) {
      const month = movement.date.slice(0, 7);
      const values = grouped.get(month) ?? { income: 0, expense: 0 };
      if (movement.amount >= 0) values.income += movement.amount;
      else values.expense -= movement.amount;
      grouped.set(month, values);
    }
    const maximum = Math.max(1, ...[...grouped.values()].flatMap((value) => [value.income, value.expense]));
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, values]) => ({
        month: new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' })
          .format(new Date(`${month}-01T00:00:00Z`))
          .replace('.', ''),
        income: values.income,
        expense: values.expense,
        net: values.income - values.expense,
        incomePercent: Math.round((values.income / maximum) * 100),
        expensePercent: Math.round((values.expense / maximum) * 100),
      }));
  });
  readonly reportCategories = computed(() => {
    const totals = new Map<string, number>();
    for (const movement of this.reportMovements()) {
      if (movement.amount < 0) totals.set(movement.category, (totals.get(movement.category) ?? 0) - movement.amount);
    }
    const palette = ['#0f766e', '#2563eb', '#e76f51', '#8b5cf6', '#d97706', '#64748b'];
    const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
    return [...totals.entries()]
      .sort(([, left], [, right]) => right - left)
      .slice(0, 6)
      .map(([name, value], index) => ({
        name,
        color: palette[index % palette.length],
        percent: total ? Math.round((value / total) * 100) : 0,
        value,
      }));
  });
  readonly reportNetRange = computed(() => Math.max(1, ...this.reportSeries().map((point) => Math.abs(point.net))));
  readonly reportNetPoints = computed(() =>
    this.chartPoints(
      this.reportSeries().map((point) => point.net + this.reportNetRange()),
      this.reportNetRange() * 2,
      600,
      160,
    ),
  );
  readonly topCategory = computed(() => {
    const values = new Map<string, number>();
    this.reportMovements()
      .filter((movement) => movement.amount < 0)
      .forEach((movement) => values.set(movement.category, (values.get(movement.category) ?? 0) - movement.amount));
    const top = [...values.entries()].sort((a, b) => b[1] - a[1])[0];
    return { name: top?.[0] ?? 'Sin datos', value: top?.[1] ?? 0 };
  });
  readonly themes = [
    { id: 'system', label: 'Igual que el sistema', preview: 'linear-gradient(135deg,#fff 50%,#0b2830 50%)' },
    { id: 'light', label: 'Verona claro', preview: 'linear-gradient(135deg,#fff 50%,#087f68 50%)' },
    { id: 'dark', label: 'Esmeralda noche', preview: 'linear-gradient(135deg,#082128 50%,#29b98f 50%)' },
    { id: 'ocean', label: 'Océano', preview: 'linear-gradient(135deg,#0a2033 50%,#38bdf8 50%)' },
    { id: 'sand', label: 'Arena', preview: 'linear-gradient(135deg,#fffaf2 50%,#a24f2a 50%)' },
    { id: 'berry', label: 'Mora', preview: 'linear-gradient(135deg,#301a37 50%,#f0abfc 50%)' },
  ] as const;
  readonly fonts = [
    { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { label: 'DM Sans', value: "'DM Sans', system-ui, sans-serif" },
    { label: 'Manrope', value: 'Manrope, system-ui, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Trebuchet', value: "'Trebuchet MS', sans-serif" },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Palatino', value: "'Palatino Linotype', serif" },
    { label: 'Courier', value: "'Courier New', monospace" },
    { label: 'System UI', value: 'system-ui, sans-serif' },
  ];
  // Fecha, concepto e importe son las tres columnas que nunca se ocultan en una
  // tabla financiera. El importe estaba al final de nueve y quedaba fuera de
  // pantalla; el resto pasa detras porque se puede desplazar sin perder el dato.
  readonly movementColumns = [
    { key: 'date', label: 'Fecha' },
    { key: 'description', label: 'Descripción' },
    { key: 'amount', label: 'Importe' },
    { key: 'account', label: 'Cuenta o tarjeta' },
    { key: 'effect', label: 'Débito / crédito' },
    { key: 'currency', label: 'Moneda / tasa' },
    { key: 'financing', label: 'Cuotas / préstamo' },
    { key: 'responsibility', label: 'Responsabilidad' },
    { key: 'recurrence', label: 'Recurrencia' },
  ];
  readonly peopleColumns = [
    { key: 'name', label: 'Persona' },
    { key: 'relationship', label: 'Relación' },
    { key: 'owed', label: 'Me debe' },
    { key: 'owing', label: 'Le debo' },
    { key: 'balance', label: 'Saldo' },
    { key: 'payment', label: 'Comportamiento de pago' },
  ];
  readonly investmentColumns = [
    { key: 'name', label: 'Inversión' },
    { key: 'type', label: 'Tipo' },
    { key: 'institution', label: 'Institución' },
    { key: 'risk', label: 'Riesgo / liquidez' },
    { key: 'cost', label: 'Costo' },
    { key: 'value', label: 'Valor actual' },
    { key: 'return', label: 'Variación' },
  ];
  readonly userColumns = [
    { key: 'name', label: 'Miembro' },
    { key: 'email', label: 'Correo' },
    { key: 'role', label: 'Perfil' },
    { key: 'status', label: 'Estado' },
    { key: 'access', label: 'Capacidades' },
  ];
  readonly userRows = this.store.users.map((u) => ({
    name: u.name,
    email: u.email,
    role: u.id === 'demo-owner' ? 'Administradora' : 'Revisor',
    status: 'Activo',
    access: u.capabilities.length + ' capacidades',
  }));
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
      effect: m.status === 'pending' ? 'Pendiente' : m.amount < 0 ? 'Débito' : 'Crédito',
      financing: m.installmentTotal
        ? `Cuota ${m.installmentCurrent}/${m.installmentTotal}`
        : m.loanRole === 'lent'
          ? 'Préstamo otorgado'
          : m.loanRole === 'borrowed'
            ? 'Préstamo recibido'
            : m.loanRole === 'repayment'
              ? 'Pago de préstamo'
              : 'Una cuota',
      responsibility: m.person ? `Prestado · ${m.person}` : 'Propio',
      recurrence: m.recurring
        ? m.recurrence === 'weekly'
          ? 'Semanal'
          : m.recurrence === 'yearly'
            ? 'Anual'
            : 'Mensual'
        : 'No recurrente',
      currency:
        m.originalCurrency === 'USD'
          ? `USD ${m.originalAmount?.toLocaleString('en-US')} · TRM ${m.exchangeRate?.toLocaleString('es-CO')}`
          : (this.store.account(m.accountId)?.currency ?? 'COP'),
      amount: this.store.money(m.amount),
      raw: m,
    })),
  );
  readonly peopleRows = computed(() =>
    this.store.data().people.map((p) => ({
      id: p.id,
      name: p.name,
      relationship: p.relationship ?? SIN_DATO,
      owed: this.store.money(p.owed),
      owing: this.store.money(p.owing),
      balance: this.store.money(p.owed - p.owing),
      payment:
        p.averagePaymentDays == null
          ? 'Sin historial'
          : `${p.averagePaymentDays} días prom. · ${p.latePayments ?? 0} tardíos`,
    })),
  );
  readonly investmentRows = computed(() =>
    this.store.data().investments.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      institution: i.institution ?? SIN_DATO,
      risk: i.risk && i.liquidity ? `${i.risk} · ${i.liquidity}` : SIN_DATO,
      cost: this.store.money(i.cost),
      value: this.store.money(i.value),
      return: ((i.value / i.cost - 1) * 100).toFixed(1) + ' %',
    })),
  );
  readonly peopleOwed = computed(() => this.store.data().people.reduce((s, p) => s + p.owed, 0));
  readonly peopleOwing = computed(() => this.store.data().people.reduce((s, p) => s + p.owing, 0));
  readonly investmentValue = computed(() => this.store.data().investments.reduce((s, i) => s + i.value, 0));
  readonly investmentGain = computed(() => this.store.data().investments.reduce((s, i) => s + i.value - i.cost, 0));
  readonly slowestPayer = computed(() => {
    const person = [...this.store.data().people].sort(
      (a, b) => (b.averagePaymentDays ?? 0) - (a.averagePaymentDays ?? 0),
    )[0];
    return { name: person?.name ?? 'Sin datos', days: person?.averagePaymentDays ?? 0 };
  });
  readonly investmentReturn = computed(() => {
    const d = this.store.data().investments,
      c = d.reduce((s, i) => s + i.cost, 0);
    return ((d.reduce((s, i) => s + i.value, 0) / c - 1) * 100).toFixed(1) + ' %';
  });
  ngAfterViewInit(): void {
    if (this.route.snapshot.queryParamMap.get('focus') === 'search')
      queueMicrotask(() => this.searchInput?.nativeElement.focus());
    if (this.page() === 'calendar') void this.loadCalendarProjection();
  }
  /** En pantallas estrechas los filtros arrancan plegados: primero el dinero. */
  readonly filtersOpen = signal(typeof window === 'undefined' || window.innerWidth > 700);
  readonly activeFilterCount = computed(
    () =>
      [
        this.store.query() !== '',
        this.store.period() !== 'all',
        this.store.accountFilter() !== 'all',
        this.movementAccountType() !== 'all',
        this.movementCategory() !== 'all',
        this.movementOperation() !== 'all',
      ].filter(Boolean).length,
  );
  /** El boton de restablecer solo aparece cuando hay algo que restablecer. */
  readonly hasActiveFilters = computed(
    () =>
      this.store.query() !== '' ||
      this.store.period() !== 'all' ||
      this.store.accountFilter() !== 'all' ||
      this.movementAccountType() !== 'all' ||
      this.movementCategory() !== 'all' ||
      this.movementOperation() !== 'all',
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
  /**
   * Exporta el periodo del informe: una fila por mes con ingresos, gastos y neto, y
   * debajo el reparto por categoria. Es lo que protege `reportes.exportar`.
   */
  exportReport(): void {
    const SALTO = '\r\n';
    if (!this.can(P.reportes.exportar)) return;
    const meses = toCsv(this.reportSeries(), [
      { header: 'Mes', value: (fila) => fila.month },
      { header: 'Ingresos', value: (fila) => fila.income },
      { header: 'Gastos', value: (fila) => fila.expense },
      { header: 'Neto', value: (fila) => fila.net },
    ]);
    const categorias = toCsv(this.reportCategories(), [
      { header: 'Categoria', value: (fila) => fila.name },
      { header: 'Gasto', value: (fila) => fila.value },
      { header: 'Porcentaje', value: (fila) => fila.percent },
    ]);
    const periodo = `Periodo;${this.reportPeriod()} meses`;
    downloadCsv(`finanzas-reporte-${this.reportPeriod()}m.csv`, [periodo, '', meses, '', categorias].join(SALTO));
    this.store.toast.set('Reporte exportado.');
  }

  /** Exporta los movimientos que hay a la vista, con los filtros aplicados. */
  exportMovements(): void {
    if (!this.can(P.reportes.exportar)) return;
    const filas = this.movementRows();
    downloadCsv(
      `finanzas-movimientos-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        filas,
        this.movementColumns.map((columna) => ({
          header: columna.label,
          value: (fila: Record<string, unknown>) => fila[columna.key],
        })),
      ),
    );
    this.store.toast.set(`${filas.length} movimientos exportados.`);
  }

  clearFilters() {
    this.store.query.set('');
    this.store.period.set('all');
    this.store.accountFilter.set('all');
    this.movementAccountType.set('all');
    this.movementCategory.set('all');
    this.movementOperation.set('all');
    void this.loadMovementPage(1);
  }
  async loadMovementPage(page: number): Promise<void> {
    if (this.store.runtime.mode !== 'api') return;
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
  changeMovementPageSize(size: number) {
    this.store.remoteMovementSize.set(size);
    void this.loadMovementPage(1);
  }
  async loadCalendarProjection() {
    if (this.store.runtime.mode !== 'api') return;
    const start = `${this.calendarYear()}-${String(this.calendarMonth() + 1).padStart(2, '0')}-01`;
    const end = new Date(Date.UTC(this.calendarYear(), this.calendarMonth() + 1, 0)).toISOString().slice(0, 10);
    try {
      const [projected, recurrences] = await Promise.all([
        firstValueFrom(this.api.projectedCalendar(start, end)),
        firstValueFrom(this.api.recurrences()),
      ]);
      this.projectedOccurrences.set(projected);
      this.recurrences.set(recurrences);
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo cargar el calendario proyectado.');
    }
  }
  async materialize(item: ApiProjectedOccurrence) {
    if (this.store.runtime.mode !== 'api') return this.store.log('Ocurrencia confirmada y registrada');
    try {
      await firstValueFrom(
        this.api.materializeRecurrence(item.recurrence.id, {
          occurrence: item.occurrence,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      this.store.toast.set('Ocurrencia confirmada y registrada en el libro.');
      await Promise.all([this.loadCalendarProjection(), this.loadMovementPage(1)]);
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo confirmar la ocurrencia.');
    }
  }
  private toRemoteMovement(source: ApiMovement): import('../core/demo-data').Movement {
    // Misma tabla de invariantes que usa el arranque remoto: aquí estaba
    // duplicada la expresión de signo y la lista de clases escrita a mano.
    return {
      id: source.id,
      date: source.date,
      description: source.description ?? 'Sin descripción',
      accountId: source.links['account'] ?? source.links['card'] ?? '',
      category: source.linkNames['category']?.name ?? 'Sin categoría',
      kind: this.store.kindCatalog().family(source.kind, source.effect, source.flow),
      amount: parseMoney(source.amount.base) * signOf(source.flow, source.effect),
      status: 'confirmed',
      person: source.linkNames['counterparty']?.name,
      ownership: source.links['counterparty'] ? 'loaned' : 'own',
      recurring: Boolean(source.links['recurrence']),
    };
  }
  inspectMovement(row: Record<string, unknown>) {
    this.store.inspect('movement', String(row['id']));
  }
  dayMoves(date: string | number) {
    const iso = typeof date === 'number' ? `2026-08-${String(date).padStart(2, '0')}` : date;
    return this.store.data().movements.filter((movement) => movement.date === iso);
  }
  setAccountQuery(value: string) {
    this.accountQuery.set(value);
    this.accountPage.set(0);
  }
  setAccountType(value: 'all' | 'savings' | 'credit' | 'cash') {
    this.accountType.set(value);
    this.accountPage.set(0);
  }
  setCalendarView(view: 'day' | 'week' | 'month' | 'year') {
    this.calendarView.set(view);
  }
  shiftCalendar(direction: -1 | 1) {
    const selected = new Date(`${this.selectedCalendarDate()}T00:00:00Z`);
    const view = this.calendarView();
    if (view === 'day') selected.setUTCDate(selected.getUTCDate() + direction);
    else if (view === 'week') selected.setUTCDate(selected.getUTCDate() + direction * 7);
    else if (view === 'month') selected.setUTCMonth(selected.getUTCMonth() + direction);
    else selected.setUTCFullYear(selected.getUTCFullYear() + direction);
    this.calendarYear.set(selected.getUTCFullYear());
    this.calendarMonth.set(selected.getUTCMonth());
    this.selectedCalendarDate.set(selected.toISOString().slice(0, 10));
    void this.loadCalendarProjection();
  }
  goCalendarToday() {
    const now = new Date();
    this.calendarYear.set(now.getFullYear());
    this.calendarMonth.set(now.getMonth());
    this.selectedCalendarDate.set(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    );
    void this.loadCalendarProjection();
  }
  openCalendarMonth(month: number) {
    this.calendarMonth.set(month);
    this.selectedCalendarDate.set(`${this.calendarYear()}-${String(month + 1).padStart(2, '0')}-01`);
    this.calendarView.set('month');
    void this.loadCalendarProjection();
  }
  monthMovementCount(month: number) {
    const prefix = `${this.calendarYear()}-${String(month + 1).padStart(2, '0')}`;
    return this.store.data().movements.filter((movement) => movement.date.startsWith(prefix)).length;
  }
  selectCalendarDay(iso: string) {
    this.selectedCalendarDate.set(iso);
    this.calendarReturnDate.set(null);
    const movements = this.dayMoves(iso);
    if (movements.length === 1) {
      this.calendarReturnDate.set(iso);
      this.store.inspect('movement', movements[0].id);
    } else this.store.inspect('day', iso);
  }
  selectAccount(id: string, type: string) {
    this.selectedAccountFilter.set(id);
    this.cardPaymentMode.set(false);
    this.store.inspect(type === 'credit' ? 'card' : 'account', id);
  }
  openDayMovement(id: string) {
    this.calendarReturnDate.set(this.store.inspector()?.id ?? this.selectedCalendarDate());
    this.store.inspect('movement', id);
  }
  returnToCalendarDay() {
    const date = this.calendarReturnDate();
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
    this.cardPaymentMode.set(false);
  }
  displayBalance(account: import('../core/demo-data').Account): number {
    const value = this.store.balance(account);
    return account.type === 'credit' ? (value < 0 ? -value : 0) : value;
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
            : this.dayMoves(this.store.inspector()?.id ?? this.selectedCalendarDate()).length + ' operaciones';
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
        ['Variación', ((i.value / i.cost - 1) * 100).toFixed(1) + ' %'],
      ];
    return [
      ['Fecha', this.store.inspector()?.id ?? this.selectedCalendarDate()],
      ['Operaciones', String(this.dayMoves(this.store.inspector()?.id ?? this.selectedCalendarDate()).length)],
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
      await this.loadMovementPage(this.store.remoteMovementPage());
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
  async readAll() {
    if (this.store.runtime.mode === 'api') {
      try {
        const unread = this.store.data().notifications.filter((item) => !item.read);
        await Promise.all(unread.map((item) => firstValueFrom(this.api.markNotificationRead(item.id))));
      } catch (error) {
        this.store.toast.set(error instanceof Error ? error.message : 'No se pudieron actualizar las notificaciones.');
        return;
      }
    }
    this.store.data.update((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
  }
  async mark(id: string) {
    if (this.store.runtime.mode === 'api') {
      try {
        await firstValueFrom(this.api.markNotificationRead(id));
      } catch (error) {
        this.store.toast.set(error instanceof Error ? error.message : 'No se pudo actualizar la notificación.');
        return;
      }
    }
    this.store.data.update((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }
  reviewNotification(id: string) {
    const pending = this.store.data().movements.find((movement) => movement.status === 'pending');
    this.store.open('expense', pending?.accountId ?? 'credit-indigo', pending, id);
  }
  setTheme(theme: (typeof this.themes)[number]['id']) {
    this.store.preferences.update((p) => ({ ...p, theme }));
    applyTheme(theme);
    this.persistPreferences();
  }
  setFont(font: string) {
    this.store.preferences.update((p) => ({ ...p, font }));
    document.documentElement.style.setProperty('--font', font);
    this.persistPreferences();
  }
  setLocale(locale: string) {
    this.store.preferences.update((value) => ({ ...value, locale }));
    this.store.log('Formato regional actualizado');
    this.persistPreferences();
  }
  setAccent(accent: string) {
    this.store.preferences.update((value) => ({ ...value, accent }));
    document.documentElement.style.setProperty('--accent', accent);
    this.persistPreferences();
  }
  setThemeValue(key: 'name' | 'primary' | 'secondary' | 'text' | 'surface' | 'border', value: string) {
    this.store.preferences.update((preferences) => ({ ...preferences, [key]: value }));
    const cssKey = (
      {
        primary: '--accent',
        secondary: '--secondary',
        text: '--text',
        surface: '--surface',
        border: '--line',
      } as Record<string, string>
    )[key];
    if (cssKey) document.documentElement.style.setProperty(cssKey, value);
  }
  saveCustomTheme() {
    this.persistPreferences();
    this.store.log(`Tema “${this.store.preferences().name}” guardado`);
  }
  setDensity(density: 'comfortable' | 'compact') {
    this.store.preferences.update((value) => ({ ...value, density }));
    document.documentElement.dataset['density'] = density;
    this.persistPreferences();
  }
  setRadius(radius: number | string) {
    const value = Number(radius);
    this.store.preferences.update((preferences) => ({ ...preferences, radius: value }));
    document.documentElement.style.setProperty('--radius', `${value}px`);
    this.persistPreferences();
  }
  chartPoints(values: readonly number[], maximum: number, width: number, height: number): string {
    const safeMaximum = Math.max(1, maximum);
    const drawableHeight = height - 20;
    return values
      .map((value, index) => {
        const x = values.length < 2 ? width / 2 : (index / (values.length - 1)) * width;
        const y = 10 + drawableHeight - (Math.max(0, value) / safeMaximum) * drawableHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
  private persistPreferences() {
    void this.store
      .persistPreferences()
      .catch((error) =>
        this.store.toast.set(error instanceof Error ? error.message : 'No fue posible guardar las preferencias.'),
      );
  }
  async logout(): Promise<void> {
    if (this.store.runtime.mode === 'api') {
      try {
        await firstValueFrom(this.api.logout());
      } catch (error) {
        this.store.toast.set(error instanceof Error ? error.message : 'No fue posible cerrar la sesión remota.');
        return;
      }
    }
    this.store.user.set(null);
    this.store.form.set(null);
    this.store.inspector.set(null);
    await this.router.navigateByUrl('/login');
  }
}
