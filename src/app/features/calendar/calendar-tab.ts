import { ChangeDetectionStrategy, Component, inject, computed, signal, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiProjectedOccurrence, ApiRecurrence, FinanceApiClient } from '../../core/api-client';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { I18nService } from '../../core/i18n';
import { sincronizarConLaUrl } from '../../core/url-state';
import { MovementsBookService } from '../../shared/movements/movements-book.service';

@Component({
  selector: 'app-calendar-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-tab.html',
  styleUrl: './calendar-tab.css',
})
export class CalendarTabComponent implements OnInit {
  readonly store = inject(DemoStore);
  readonly i18n = inject(I18nService);
  private readonly capabilities = inject(CAPABILITIES);
  private api = inject(FinanceApiClient);
  private readonly movementsBook = inject(MovementsBookService);
  readonly P = P;
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly projectedOccurrences = signal<readonly ApiProjectedOccurrence[]>([]);
  readonly recurrences = signal<readonly ApiRecurrence[]>([]);
  readonly week = computed(() => [
    this.i18n.t('calendar.weekday.mon'),
    this.i18n.t('calendar.weekday.tue'),
    this.i18n.t('calendar.weekday.wed'),
    this.i18n.t('calendar.weekday.thu'),
    this.i18n.t('calendar.weekday.fri'),
    this.i18n.t('calendar.weekday.sat'),
    this.i18n.t('calendar.weekday.sun'),
  ]);
  readonly calendarYear = signal(2026);
  readonly calendarMonth = signal(7);
  readonly calendarViews = [
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'year', label: 'Año' },
  ] as const;
  readonly calendarView = signal<'day' | 'week' | 'month' | 'year'>('month');
  private readonly urlDelCalendario = sincronizarConLaUrl('vista', this.calendarView, 'month', (v) =>
    ['day', 'week', 'month', 'year'].includes(v),
  );
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
    const selected = this.store.selectedCalendarDate();
    const selectedIndex = Math.max(
      0,
      days.findIndex((day) => day.iso === selected),
    );
    if (view === 'day') return days.slice(selectedIndex, selectedIndex + 1);
    const weekStart = Math.floor(selectedIndex / 7) * 7;
    return days.slice(weekStart, weekStart + 7);
  });
  readonly calendarTitle = computed(() => {
    const date = new Date(`${this.store.selectedCalendarDate()}T00:00:00Z`);
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

  ngOnInit(): void {
    void this.loadCalendarProjection();
  }

  /**
   * Dos peticiones distintas, con dos permisos distintos y sin dependencia entre ellas.
   *
   * Iban en un `Promise.all` sin comprobar nada, asi que a quien tuviera el calendario y
   * no las recurrencias le fallaba la de recurrencias con un 403, se rechazaba la
   * promesa entera y se perdian tambien las proyecciones, que si podia ver. El aviso
   * decia «no se pudo cargar el calendario proyectado» y el permiso concedido parecia no
   * servir. Cada una se pide si su permiso esta concedido, y si una falla la otra queda.
   */
  async loadCalendarProjection(): Promise<void> {
    if (this.store.runtime.mode !== 'api') return;
    const start = `${this.calendarYear()}-${String(this.calendarMonth() + 1).padStart(2, '0')}-01`;
    const end = new Date(Date.UTC(this.calendarYear(), this.calendarMonth() + 1, 0)).toISOString().slice(0, 10);
    const fallos: string[] = [];

    if (this.can(P.calendario.ver)) {
      try {
        this.projectedOccurrences.set(await firstValueFrom(this.api.projectedCalendar(start, end)));
      } catch {
        fallos.push('las proyecciones');
      }
    }
    if (this.can(P.calendario.recurrencias.listar)) {
      try {
        this.recurrences.set(await firstValueFrom(this.api.recurrences()));
      } catch {
        fallos.push('las recurrencias');
      }
    }

    if (fallos.length) this.store.toast.set(`No se pudieron cargar ${fallos.join(' ni ')} del calendario.`);
  }
  async materialize(item: ApiProjectedOccurrence): Promise<void> {
    if (this.store.runtime.mode !== 'api') return this.store.log('Ocurrencia confirmada y registrada');
    try {
      await firstValueFrom(
        this.api.materializeRecurrence(item.recurrence.id, {
          occurrence: item.occurrence,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      this.store.toast.set('Ocurrencia confirmada y registrada en el libro.');
      await this.loadCalendarProjection();
      void this.movementsBook.loadMovementPage(1);
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo confirmar la ocurrencia.');
    }
  }
  setCalendarView(view: 'day' | 'week' | 'month' | 'year'): void {
    this.calendarView.set(view);
  }
  shiftCalendar(direction: -1 | 1): void {
    const selected = new Date(`${this.store.selectedCalendarDate()}T00:00:00Z`);
    const view = this.calendarView();
    if (view === 'day') selected.setUTCDate(selected.getUTCDate() + direction);
    else if (view === 'week') selected.setUTCDate(selected.getUTCDate() + direction * 7);
    else if (view === 'month') selected.setUTCMonth(selected.getUTCMonth() + direction);
    else selected.setUTCFullYear(selected.getUTCFullYear() + direction);
    this.calendarYear.set(selected.getUTCFullYear());
    this.calendarMonth.set(selected.getUTCMonth());
    this.store.selectedCalendarDate.set(selected.toISOString().slice(0, 10));
    void this.loadCalendarProjection();
  }
  goCalendarToday(): void {
    const now = new Date();
    this.calendarYear.set(now.getFullYear());
    this.calendarMonth.set(now.getMonth());
    this.store.selectedCalendarDate.set(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    );
    void this.loadCalendarProjection();
  }
  openCalendarMonth(month: number): void {
    this.calendarMonth.set(month);
    this.store.selectedCalendarDate.set(`${this.calendarYear()}-${String(month + 1).padStart(2, '0')}-01`);
    this.calendarView.set('month');
    void this.loadCalendarProjection();
  }
  monthMovementCount(month: number): number {
    const prefix = `${this.calendarYear()}-${String(month + 1).padStart(2, '0')}`;
    return this.store.data().movements.filter((movement) => movement.date.startsWith(prefix)).length;
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
