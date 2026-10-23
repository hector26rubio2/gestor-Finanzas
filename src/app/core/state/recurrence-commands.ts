import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient } from '@core/api/api-client';
import { I18nService } from '@core/i18n';
import { AppStore } from './store';

/** Comandos de alta de recurrencias programadas. */
@Injectable({ providedIn: 'root' })
export class RecurrenceCommands {
  constructor(
    private readonly store: AppStore,
    private readonly client: FinanceApiClient,
    private readonly i18n: I18nService,
  ) {}

  async createRecurrence(name: string, amount: number, accountId: string, frequency: number, start: string) {
    const account = this.store.account(accountId);
    if (!account) throw new Error(this.i18n.t('form.recurrence.error.accountInvalid'));
    await firstValueFrom(
      this.client.createRecurrence({
        name,
        movementTemplate: account.type === 'credit' ? 20 : 2,
        amount: { amount: String(amount), currency: account.currency },
        target: account.type === 'credit' ? { card: accountId } : { account: accountId },
        schedule: {
          frequency,
          interval: 1,
          start,
          end: null,
          dayOfMonth: frequency === 3 ? Number(start.slice(-2)) : null,
          dayOfWeek: null,
        },
      }),
    );

    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.recurrence.created', { name }));
  }
}
