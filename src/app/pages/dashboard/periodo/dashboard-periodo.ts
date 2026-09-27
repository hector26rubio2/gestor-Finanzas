import { Injectable, computed, inject, signal } from '@angular/core';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state';
import { sincronizarConLaUrl } from '@core/routing/url-state';
import { PERIODOS_DE_HISTORIA } from '@shared/historia';
import type { UiOption } from '@ui/select/select';
import type { Scale } from '@shared/tablero/dashboard.model';

export function isoDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function rangoDe(ancla: string, escala: Scale): { start: string; end: string } {
  const a = new Date(`${ancla}T12:00:00`);
  let start: Date, end: Date;
  if (escala === 'day') {
    start = new Date(a);
    end = new Date(a);
  } else if (escala === 'week') {
    const offset = (a.getDay() + 6) % 7;
    start = new Date(a);
    start.setDate(a.getDate() - offset);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else if (escala === 'month') {
    start = new Date(a.getFullYear(), a.getMonth(), 1, 12);
    end = new Date(a.getFullYear(), a.getMonth() + 1, 0, 12);
  } else {
    start = new Date(a.getFullYear(), 0, 1, 12);
    end = new Date(a.getFullYear(), 11, 31, 12);
  }
  return { start: isoDe(start), end: isoDe(end) };
}

export function desplazarAncla(ancla: string, escala: Scale, pasos: number): string {
  const date = new Date(`${ancla}T12:00:00`);
  if (escala === 'year') date.setFullYear(date.getFullYear() + pasos);
  else if (escala === 'month') {
    date.setDate(1);
    date.setMonth(date.getMonth() + pasos);
  } else date.setDate(date.getDate() + pasos * (escala === 'week' ? 7 : 1));
  return isoDe(date);
}

@Injectable()
export class DashboardPeriodo {
  private readonly store = inject(AppStore);
  private readonly i18n = inject(I18nService);

  readonly scale = signal<Scale>('month');

  readonly anclaPorDefecto = this.store.hoy();

  readonly anchor = signal(this.anclaPorDefecto);

  /**
   * Saltar de año a golpe de "‹"/"›" es razonable entre meses vecinos, pero no para ir de
   * 2026 a 1999: son mas de trescientos clics. El selector deja escribir el destino
   * directamente, sin ser el `<input type=date>` del sistema -que no encaja con el resto
   * de controles de la app-, con un `select` como todos los otros filtros.
   */
  readonly periodPickerOpen = signal(false);

  readonly anchorYear = computed(() => String(new Date(`${this.anchor()}T12:00:00`).getFullYear()));

  readonly anchorMonth = computed(() => String(new Date(`${this.anchor()}T12:00:00`).getMonth()));

  readonly anchorDay = computed(() => String(new Date(`${this.anchor()}T12:00:00`).getDate()));

  /** Días del mes/año que muestra el selector: 28-31 según el mes, sin inventar un 31 de febrero. */
  /** Días que tiene el mes del ancla; también el máximo válido para el selector de Día. */
  readonly daysInAnchorMonth = computed(() =>
    new Date(Number(this.anchorYear()), Number(this.anchorMonth()) + 1, 0).getDate(),
  );

  /**
   * Semanas del mes en bloques fijos de 7 dias (1-7, 8-14...): no son semanas ISO -esas
   * cruzan de un mes a otro y "semana 1 de enero" dejaria de significar lo mismo para
   * quien solo quiere saltar al principio del mes-, pero alcanzan para lo que se pide:
   * elegir "la primera semana de enero" sin tener que dar clic semana a semana.
   */
  readonly weekOfMonthOptions = computed<readonly UiOption[]>(() => {
    const total = this.daysInAnchorMonth();
    const semanas: UiOption[] = [];
    for (let inicio = 1, n = 1; inicio <= total; inicio += 7, n++) {
      const fin = Math.min(inicio + 6, total);
      semanas.push({
        value: String(inicio),
        label: this.i18n.t('dashboard.filters.period.weekOption', { n, start: inicio, end: fin }),
      });
    }
    return semanas;
  });

  /** Qué opción de `weekOfMonthOptions` contiene el día actual del ancla. */
  readonly anchorWeekOfMonth = computed(() => {
    const dia = Number(this.anchorDay());
    return String(Math.floor((dia - 1) / 7) * 7 + 1);
  });

  setWeekOfMonth(value: string) {
    this.setDay(value);
  }

  /** Nombres de mes según el idioma activo -mismo `Intl` que ya usa el resto del archivo para fechas. */
  readonly monthOptions = computed<readonly UiOption[]>(() => {
    const formateador = new Intl.DateTimeFormat(this.store.preferences().locale, { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => ({
      value: String(i),
      label: formateador.format(new Date(Date.UTC(2026, i, 1))),
    }));
  });

  /**
   * Solo digitos, a proposito: `<input type=number>` deja escribir "-" y "e" -notacion
   * cientifica, 1e5 es un numero valido para el navegador-, y ni un año negativo ni "2e26"
   * tienen sentido aqui. `Number(value)` los aceptaria igual, asi que la guardia va antes,
   * sobre el texto crudo.
   */
  private soloDigitos(value: string): number | null {
    const limpio = value.trim();
    return /^\d+$/.test(limpio) ? Number(limpio) : null;
  }

  setYear(value: string) {
    const year = this.soloDigitos(value);
    if (year === null || year < 1) return;
    const d = new Date(`${this.anchor()}T12:00:00`);
    d.setFullYear(year);
    this.anchor.set(isoDe(d));
  }

  setMonth(value: string) {
    const d = new Date(`${this.anchor()}T12:00:00`);
    d.setMonth(Number(value));
    this.anchor.set(isoDe(d));
  }

  setDay(value: string) {
    const day = this.soloDigitos(value);
    if (day === null || day < 1) return;
    const d = new Date(`${this.anchor()}T12:00:00`);
    d.setDate(Math.min(day, this.daysInAnchorMonth()));
    this.anchor.set(isoDe(d));
  }

  readonly scales = computed<{ value: Scale; label: string }[]>(() => [
    { value: 'day', label: this.i18n.t('dashboard.period.day') },
    { value: 'week', label: this.i18n.t('dashboard.period.week') },
    { value: 'month', label: this.i18n.t('dashboard.period.month') },
    { value: 'year', label: this.i18n.t('dashboard.period.year') },
  ]);

  readonly range = computed(() => rangoDe(this.anchor(), this.scale()));

  readonly rangosHistoricos = computed(() =>
    Array.from({ length: PERIODOS_DE_HISTORIA }, (_, indice) =>
      rangoDe(desplazarAncla(this.anchor(), this.scale(), indice - PERIODOS_DE_HISTORIA + 1), this.scale()),
    ),
  );

  readonly historiaEtiqueta = computed(() =>
    this.i18n.t(`kpi.history.${this.scale()}`, { count: PERIODOS_DE_HISTORIA }),
  );

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

  shiftPeriod(direction: number) {
    this.anchor.set(desplazarAncla(this.anchor(), this.scale(), direction));
  }

  private readonly urlDelPeriodo = [
    sincronizarConLaUrl('escala', this.scale, 'month', (v) => ['day', 'week', 'month', 'year'].includes(v)),
    sincronizarConLaUrl('fecha', this.anchor, this.anclaPorDefecto, (v) => /^\d{4}-\d{2}-\d{2}$/.test(v)),
  ];
}
