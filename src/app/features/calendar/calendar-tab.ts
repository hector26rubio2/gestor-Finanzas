import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { fechaDeHoy } from './fecha-de-hoy';
import { firstValueFrom } from 'rxjs';
import { HlmButton } from '@spartan-ng/helm/button';
import { TAB_PAGE_HOST_CLASS } from '@shared/tab-page-layout';
import { ApiProjectedOccurrence, ApiRecurrence, FinanceApiClient } from '@core/api';
import { P } from '@core/session';
import { CAPABILITIES, AppStore } from '@core/state';
import { sincronizarConLaUrl } from '@core/routing/url-state';
import { I18nService } from '@core/i18n';
import { MovementsBookService } from '@shared/movements';
import { Rango, crearMovimientosDelPeriodo, crearResumenDelAnio } from '@shared/historia';
import { ConfirmDialogComponent } from '@ui/confirm-dialog';
import { ZonaDeCargaComponent } from '@ui/zona-de-carga';
import { cardDues, creditCards } from '@features/accounts/card-insights';
import { FormsModule } from '@angular/forms';
import { DateFieldComponent } from '@ui/date-field';
import { franjasDelDia, horasVisibles } from './franjas-horarias';
import { type RangoDeFechas, enRango, rangoSiguiente, rangoVisible } from './periodos';

@Component({
  selector: 'app-calendar-tab',
  imports: [FormsModule, HlmButton, ConfirmDialogComponent, DateFieldComponent, ZonaDeCargaComponent],
  templateUrl: './calendar-tab.html',
  host: { class: TAB_PAGE_HOST_CLASS },
})
export class CalendarTabComponent implements OnInit {
  readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);
  private readonly capabilities = inject(CAPABILITIES);
  private api = inject(FinanceApiClient);
  private readonly movementsBook = inject(MovementsBookService);
  readonly P = P;

  dayClass(day: { iso: string; current: boolean }): string {
    const classes: string[] = [];
    classes.push(this.calendarView() === 'day' ? 'p-[18px]' : 'p-[7px]');
    if (day.iso === this.store.selectedCalendarDate()) classes.push('shadow-[inset_0_0_0_2px_var(--color-primary)]');
    if (!day.current) classes.push('text-muted-foreground');
    return classes.join(' ');
  }
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly projectedOccurrences = signal<readonly ApiProjectedOccurrence[]>([]);
  readonly recurrences = signal<readonly ApiRecurrence[]>([]);
  readonly recurrentesDesactivados = signal<readonly ApiRecurrence[]>([]);
  readonly week = computed(() => [
    this.i18n.t('calendar.weekday.mon'),
    this.i18n.t('calendar.weekday.tue'),
    this.i18n.t('calendar.weekday.wed'),
    this.i18n.t('calendar.weekday.thu'),
    this.i18n.t('calendar.weekday.fri'),
    this.i18n.t('calendar.weekday.sat'),
    this.i18n.t('calendar.weekday.sun'),
  ]);
  private readonly locale = computed(() => this.store.preferences().locale);
  private readonly fechaInicial = new Date(`${this.store.selectedCalendarDate()}T00:00:00Z`);
  readonly calendarYear = signal(this.fechaInicial.getUTCFullYear());
  readonly calendarMonth = signal(this.fechaInicial.getUTCMonth());
  readonly calendarViews = computed(() =>
    (['day', 'week', 'month', 'year'] as const).map((value) => ({
      value,
      label: this.i18n.t(`calendar.view.${value}`),
    })),
  );
  readonly calendarView = signal<'day' | 'week' | 'month' | 'year'>('month');
  private readonly urlDelCalendario = sincronizarConLaUrl('vista', this.calendarView, 'month', (v) =>
    ['day', 'week', 'month', 'year'].includes(v),
  );
  readonly calendarMonths = computed(() =>
    Array.from({ length: 12 }, (_, value) => ({
      value,
      label: new Intl.DateTimeFormat(this.locale(), { month: 'long', timeZone: 'UTC' }).format(
        new Date(Date.UTC(2026, value, 1)),
      ),
    })),
  );
  /** Tope de la grilla de días: 6 semanas × 7 días, sin importar el rango pedido. */
  static readonly DIAS_GRID_MAX = 42;

  readonly calendarDays = computed(() => {
    const year = this.calendarYear();
    const month = this.calendarMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: CalendarTabComponent.DIAS_GRID_MAX }, (_, index) => {
      const date = new Date(Date.UTC(year, month, index - offset + 1));
      const iso = date.toISOString().slice(0, 10);
      return {
        iso,
        day: date.getUTCDate(),
        current: date.getUTCMonth() === month,
        label: new Intl.DateTimeFormat(this.locale(), { dateStyle: 'full', timeZone: 'UTC' }).format(date),
      };
    });
  });
  /**
   * Ticket 25: la vista anual ya no deriva movimientos del año entero. Aquí el rango
   * queda nulo (la derivación en ventana del delRango se detiene) y el resumen anual
   * acota el trabajo: conteos por metadatos y agenda O(proximos).
   */
  private readonly rangoAnual = computed<Rango>(() => ({
    start: `${this.calendarYear()}-01-01`,
    end: `${this.calendarYear()}-12-31`,
  }));
  private readonly resumenAnual = crearResumenDelAnio(
    computed(() => (this.calendarView() === 'year' ? this.rangoAnual() : null)),
  );
  private readonly rangoVisible = computed<Rango | null>(() => {
    if (this.calendarView() === 'year') return null;
    const days = this.calendarDays();
    return { start: days[0].iso, end: days[days.length - 1].iso };
  });
  private readonly delRango = crearMovimientosDelPeriodo(this.rangoVisible);
  private readonly proyeccionCargando = signal(true);
  readonly cargandoRango = computed(() => this.delRango.cargando() || this.resumenAnual.cargando());
  readonly visibleCalendarDays = computed(() => {
    const view = this.calendarView();
    const days = this.calendarDays();
    if (view === 'month') return days;
    const selected = this.store.selectedCalendarDate();
    const selectedIndex = Math.max(
      0,
      days.findIndex((day) => day.iso === selected),
    );
    if (view === 'day') return days.slice(selectedIndex, selectedIndex + 1);
    const weekStart = Math.floor(selectedIndex / 7) * 7;
    return days.slice(weekStart, weekStart + 7);
  });
  readonly diasConFranjas = computed(() =>
    this.visibleCalendarDays().map((day) => {
      const movimientos = this.store.dayMoves(day.iso);
      return {
        ...day,
        ...franjasDelDia(movimientos),
        total: movimientos.length,
        titulo: new Intl.DateTimeFormat(this.locale(), { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(
          new Date(`${day.iso}T00:00:00Z`),
        ),
      };
    }),
  );
  readonly horasDeLaVista = computed(() =>
    horasVisibles(this.diasConFranjas().flatMap((day) => [...day.porHora.keys()])),
  );
  readonly columnasDeHoras = computed(
    () =>
      `4.5rem repeat(${this.visibleCalendarDays().length}, minmax(${this.calendarView() === 'week' ? '7rem' : '0'}, 1fr))`,
  );
  etiquetaDeHora(hora: number): string {
    return new Intl.DateTimeFormat(this.locale(), { hour: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 0, 1, hora)),
    );
  }
  abrirMovimiento(iso: string, id: string): void {
    this.store.selectedCalendarDate.set(iso);
    this.store.calendarReturnDate.set(iso);
    this.store.inspect('movement', id);
  }
  readonly calendarTitle = computed(() => {
    const date = new Date(`${this.store.selectedCalendarDate()}T00:00:00Z`);
    const view = this.calendarView();
    if (view === 'year') return String(this.calendarYear());
    if (view === 'day')
      return new Intl.DateTimeFormat(this.locale(), { dateStyle: 'long', timeZone: 'UTC' }).format(date);
    if (view === 'week') {
      const days = this.visibleCalendarDays();
      return days.length
        ? `${days[0].day}–${days.at(-1)?.day} · ${this.calendarMonths()[this.calendarMonth()].label}`
        : '';
    }
    return `${this.calendarMonths()[this.calendarMonth()].label} ${this.calendarYear()}`;
  });

  ngOnInit(): void {
    void this.loadCalendarProjection();
  }

  async loadCalendarProjection(): Promise<void> {
    this.proyeccionCargando.set(true);
    try {
      await this.cargarProyeccion();
    } finally {
      this.proyeccionCargando.set(false);
    }
  }

  private async cargarProyeccion(): Promise<void> {
    const start = this.periodoVisible().desde;
    const end = this.periodoSiguiente().hasta;
    let fallaronProyecciones = false;
    let fallaronRecurrentes = false;

    if (this.can(P.calendario.ver)) {
      try {
        this.projectedOccurrences.set(await firstValueFrom(this.api.projectedCalendar(start, end)));
      } catch {
        fallaronProyecciones = true;
      }
    }
    if (this.can(P.calendario.recurrencias.listar)) {
      try {
        this.recurrences.set(await firstValueFrom(this.api.recurrences()));
      } catch {
        fallaronRecurrentes = true;
      }
      try {
        this.recurrentesDesactivados.set(await firstValueFrom(this.api.inactiveRecurrences()));
      } catch {
        this.recurrentesDesactivados.set([]);
      }
    }

    if (fallaronProyecciones && fallaronRecurrentes) this.store.toast.set(this.i18n.t('calendar.load.failedBoth'));
    else if (fallaronProyecciones) this.store.toast.set(this.i18n.t('calendar.load.failedProjections'));
    else if (fallaronRecurrentes) this.store.toast.set(this.i18n.t('calendar.load.failedRecurrences'));
  }
  readonly vencimientos = computed(() =>
    cardDues(creditCards(this.store.data().accounts), (tarjeta) => this.store.deudaDe(tarjeta), this.store.hoy()),
  );
  private readonly anclaDelPeriodo = computed(() => {
    const vista = this.calendarView();
    if (vista === 'day' || vista === 'week') return this.store.selectedCalendarDate();
    const mes = vista === 'year' ? 1 : this.calendarMonth() + 1;
    return `${this.calendarYear()}-${String(mes).padStart(2, '0')}-01`;
  });
  protected readonly LIMITE_DE_AGENDA = 8;
  readonly periodoVisible = computed(() => rangoVisible(this.calendarView(), this.anclaDelPeriodo()));
  readonly periodoSiguiente = computed(() => rangoSiguiente(this.calendarView(), this.anclaDelPeriodo()));
  private ocurrenciasEn(rango: RangoDeFechas): readonly ApiProjectedOccurrence[] {
    return this.projectedOccurrences()
      .filter((item) => enRango(item.occurrence, rango))
      .sort((a, b) => a.occurrence.localeCompare(b.occurrence));
  }
  readonly ocurrenciasPendientes = computed(() => this.ocurrenciasEn(this.periodoVisible()));
  readonly ocurrenciasProximas = computed(() => this.ocurrenciasEn(this.periodoSiguiente()));
  readonly recurrentesDelPeriodo = computed(() => {
    const visible = this.periodoVisible();
    const conPendiente = new Set(this.ocurrenciasPendientes().map((item) => item.recurrence.id));
    return this.recurrences().filter(
      (recurrente) =>
        conPendiente.has(recurrente.id) || recurrente.materializedOccurrences.some((fecha) => enRango(fecha, visible)),
    );
  });
  readonly vencimientosPendientes = computed(() =>
    this.vencimientos().filter((vencimiento) => enRango(vencimiento.date, this.periodoVisible())),
  );
  readonly vencimientosProximos = computed(() =>
    this.vencimientos().filter((vencimiento) => enRango(vencimiento.date, this.periodoSiguiente())),
  );
  readonly movimientosPendientes = computed(() =>
    this.proximosMovimientos().filter((movimiento) => enRango(movimiento.date, this.periodoVisible())),
  );
  readonly movimientosProximos = computed(() =>
    this.proximosMovimientos().filter((movimiento) => enRango(movimiento.date, this.periodoSiguiente())),
  );
  readonly hayPendientes = computed(
    () =>
      this.ocurrenciasPendientes().length + this.vencimientosPendientes().length + this.movimientosPendientes().length >
      0,
  );
  readonly hayProximos = computed(
    () =>
      this.ocurrenciasProximas().length + this.vencimientosProximos().length + this.movimientosProximos().length > 0,
  );
  readonly proximosMovimientos = computed(() => {
    const hoy = this.store.hoy();
    // Ticket 25: en la vista anual la agenda sale del resumen acotado (≤ 7 derivados);
    // en el resto de vistas, de la ventana del periodo visible (sin cambio de conducta).
    const fuente = this.calendarView() === 'year' ? this.resumenAnual.proximos() : this.delRango.movimientos();
    return fuente
      .filter((movimiento) => movimiento.date > hoy)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7);
  });
  readonly sinCompromisos = computed(() => !this.hayPendientes() && !this.hayProximos());
  readonly hayAgenda = computed(
    () =>
      this.recurrentesDelPeriodo().length > 0 || this.recurrentesDesactivados().length > 0 || !this.sinCompromisos(),
  );
  readonly cargandoAgenda = computed(() => this.proyeccionCargando() || this.cargandoRango());
  fechaCorta(iso: string): string {
    return new Intl.DateTimeFormat(this.locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  }
  readonly porEliminar = signal<ApiRecurrence | null>(null);
  frecuencia(recurrente: ApiRecurrence): string {
    return this.i18n.t(`calendar.recurring.frequency.${recurrente.schedule.frequency}`, {
      n: recurrente.schedule.interval,
    });
  }
  async eliminarRecurrente(): Promise<void> {
    const recurrente = this.porEliminar();
    this.porEliminar.set(null);
    if (!recurrente) return;
    try {
      await firstValueFrom(this.api.deleteRecurrence(recurrente.id));
      this.store.toast.set(this.i18n.t('calendar.recurring.deactivated', { name: recurrente.name }));
      await this.loadCalendarProjection();
    } catch {
      this.store.toast.set(this.i18n.t('calendar.recurring.deactivateFailed'));
    }
  }
  async reactivarRecurrente(recurrente: ApiRecurrence): Promise<void> {
    try {
      await firstValueFrom(this.api.reactivateRecurrence(recurrente.id));
      this.store.toast.set(this.i18n.t('calendar.recurring.reactivated', { name: recurrente.name }));
      await this.loadCalendarProjection();
    } catch {
      this.store.toast.set(this.i18n.t('calendar.recurring.reactivateFailed'));
    }
  }
  async materialize(item: ApiProjectedOccurrence): Promise<void> {
    try {
      await firstValueFrom(
        this.api.materializeRecurrence(item.recurrence.id, {
          occurrence: item.occurrence,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      this.store.toast.set(this.i18n.t('calendar.agenda.materialized'));
      await this.loadCalendarProjection();
      void this.movementsBook.loadMovementPage(1);
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo confirmar la ocurrencia.');
    }
  }
  setCalendarView(view: 'day' | 'week' | 'month' | 'year'): void {
    this.calendarView.set(view);
    void this.loadCalendarProjection();
  }
  shiftCalendar(direction: -1 | 1): void {
    const selected = new Date(`${this.store.selectedCalendarDate()}T00:00:00Z`);
    const view = this.calendarView();
    if (view === 'day') selected.setUTCDate(selected.getUTCDate() + direction);
    else if (view === 'week') selected.setUTCDate(selected.getUTCDate() + direction * 7);
    else {
      const meses = selected.getUTCFullYear() * 12 + selected.getUTCMonth() + direction * (view === 'month' ? 1 : 12);
      const anio = Math.floor(meses / 12);
      const mes = meses % 12;
      const diasDelMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
      selected.setTime(Date.UTC(anio, mes, Math.min(selected.getUTCDate(), diasDelMes)));
    }
    this.calendarYear.set(selected.getUTCFullYear());
    this.calendarMonth.set(selected.getUTCMonth());
    this.store.selectedCalendarDate.set(selected.toISOString().slice(0, 10));
    void this.loadCalendarProjection();
  }
  goCalendarToday(): void {
    const hoy = fechaDeHoy(this.store.hoy());
    this.calendarYear.set(hoy.anio);
    this.calendarMonth.set(hoy.mes);
    this.store.selectedCalendarDate.set(hoy.iso);
    void this.loadCalendarProjection();
  }
  irAFecha(iso: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const [anio, mes] = iso.split('-').map(Number);
    this.calendarYear.set(anio);
    this.calendarMonth.set(mes - 1);
    this.store.selectedCalendarDate.set(iso);
    void this.loadCalendarProjection();
  }
  openCalendarMonth(month: number): void {
    this.calendarMonth.set(month);
    this.store.selectedCalendarDate.set(`${this.calendarYear()}-${String(month + 1).padStart(2, '0')}-01`);
    this.calendarView.set('month');
    void this.loadCalendarProjection();
  }
  monthMovementCount(month: number): number {
    // Ticket 25: en la vista anual los conteos salen del resumen acotado (O(conteos),
    // sin derivar movimientos); en el resto de vistas, de la ventana del periodo.
    if (this.calendarView() === 'year') return this.resumenAnual.conteosPorMes()[month] ?? 0;
    const prefix = `${this.calendarYear()}-${String(month + 1).padStart(2, '0')}`;
    return this.delRango.movimientos().filter((movement) => movement.date.startsWith(prefix)).length;
  }
  selectCalendarDay(iso: string): void {
    this.store.selectedCalendarDate.set(iso);
    this.store.calendarReturnDate.set(null);
    const movements = this.store.dayMoves(iso);
    if (movements.length === 1) {
      this.store.calendarReturnDate.set(iso);
      this.store.inspect('movement', movements[0].id);
    } else this.store.inspect('day', iso);
  }
}
