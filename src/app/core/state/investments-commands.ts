import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient } from '@core/api/api-client';
import { parseMoney } from '@core/utils/money';
import { I18nService } from '@core/i18n';
import { AppStore } from './store';

/** Comandos de alta/edición de inversiones. */
@Injectable({ providedIn: 'root' })
export class InvestmentsCommands {
  constructor(
    private readonly store: AppStore,
    private readonly client: FinanceApiClient,
    private readonly i18n: I18nService,
  ) {}

  async createInvestment(name: string, instrumentType: string, currency: string) {
    const created = await firstValueFrom(this.client.createInvestment({ name, instrumentType, currency, risk: 2 }));
    this.store.data.update((data) => ({
      ...data,
      investments: [
        ...data.investments,
        {
          id: created.id,
          name: created.name,
          type: created.instrumentType,
          cost: parseMoney(created.costBasis),
          value: parseMoney(created.marketValue ?? created.costBasis),
          institution: 'Sin especificar',
          currency,
          units: 0,
          risk: 'Medio',
          liquidity: 'Programada',
        },
      ],
    }));

    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.investment.created', { name }));
  }

  async updateInvestment(id: string, changes: { name: string; instrumentType: string }) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    if (!this.store.data().investments.some((investment) => investment.id === id))
      throw new Error(this.i18n.t('form.error.notFound'));
    const remota = (await firstValueFrom(this.client.investments())).find((investment) => investment.id === id);
    if (!remota) throw new Error(this.i18n.t('form.error.notFound'));
    await firstValueFrom(
      this.client.updateInvestment(id, {
        name,
        instrumentType: changes.instrumentType,
        risk: remota.risk ?? 2,
        symbol: remota.symbol ?? null,
        isActive: remota.isActive,
      }),
    );

    this.store.data.update((data) => ({
      ...data,
      investments: data.investments.map((investment) =>
        investment.id === id ? { ...investment, name, type: changes.instrumentType } : investment,
      ),
    }));
    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.investment.updated', { name }));
  }
}
