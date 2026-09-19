import { Injectable, effect, inject, untracked } from '@angular/core';
import { injectBrnCalendarI18n } from '@spartan-ng/brain/calendar';
import { AppStore } from '../../core/state/store';

const REFERENCE_SUNDAY = new Date(2023, 0, 1, 12);

@Injectable({ providedIn: 'root' })
export class CalendarLocale {
  private readonly calendar = injectBrnCalendarI18n();
  private readonly store = inject(AppStore);

  constructor() {
    effect(() => {
      const locale = this.store.preferences().locale;
      const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
      const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' });
      const month = new Intl.DateTimeFormat(locale, { month: 'short' });
      const monthLong = new Intl.DateTimeFormat(locale, { month: 'long' });
      const at = (base: Date, days: number, months = 0) =>
        new Date(base.getFullYear(), base.getMonth() + months, base.getDate() + days, 12);
      untracked(() =>
        this.calendar.use({
          formatWeekdayName: (index) => weekday.format(at(REFERENCE_SUNDAY, index)),
          labelWeekday: (index) => weekdayLong.format(at(REFERENCE_SUNDAY, index)),
          formatMonth: (index) => month.format(new Date(2023, index, 1, 12)),
          formatHeader: (index, year) => `${monthLong.format(new Date(year, index, 1, 12))} ${year}`,
          months: () =>
            Array.from({ length: 12 }, (_, index) => monthLong.format(new Date(2023, index, 1, 12))) as [
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              string,
            ],
          firstDayOfWeek: () => (locale.startsWith('en') ? 0 : 1),
        }),
      );
    });
  }
}
