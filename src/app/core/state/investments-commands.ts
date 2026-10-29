import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient } from '@core/api/api-client';
import { parseMoney } from '@core/utils/money';
import type { Investment } from './view-model';
import { I18nService } from '@core/i18n';
import { AppStore } from './store';

const RIESGOS: Readonly<Record<number, NonNullable<Investment['risk']>>> = { 1: 'Bajo', 2: 'Medio', 3: 'Alto' };

export interface OperacionDeInversion {
  type: number;
  date: string;
  amount: number;
  currency: string;
  account?: string;
  quantity?: number;
  unitPrice?: number;
  description?: string;
}

export interface ValorizacionDeInversion {
  date: string;
  value: number;
  currency: string;
  source: number;
  reference?: string;
}

@Injectable({ providedIn: 'root' })
export class InvestmentsCommands {
  constructor(
    private readonly store: AppStore,
    private readonly client: FinanceApiClient,
    private readonly i18n: I18nService,
  ) {}

  async createInvestment(
    name: string,
    instrumentType: string,
    currency: string,
    detalles: { risk: number; symbol: string; institution: string } = { risk: 2, symbol: '', institution: '' },
  ) {
    const symbol = detalles.symbol.trim();
    const institution = detalles.institution.trim();
    const created = await firstValueFrom(
      this.client.createInvestment({
        name,
        instrumentType,
        currency,
        risk: detalles.risk,
        symbol: symbol || null,
        institution: institution || null,
      }),
    );
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
          institution: institution || undefined,
          symbol: symbol || undefined,
          currency,
          units: 0,
          risk: RIESGOS[detalles.risk],
          netContributions: 0,
          sinValoracion: created.marketValue == null,
        },
      ],
    }));

    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.investment.created', { name }));
  }

  async updateInvestment(id: string, changes: { name: string; instrumentType: string; risk: number; symbol: string }) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    if (!this.store.data().investments.some((investment) => investment.id === id))
      throw new Error(this.i18n.t('form.error.notFound'));
    const remota = (await firstValueFrom(this.client.investments())).find((investment) => investment.id === id);
    if (!remota) throw new Error(this.i18n.t('form.error.notFound'));
    const symbol = changes.symbol.trim();
    await firstValueFrom(
      this.client.updateInvestment(id, {
        name,
        instrumentType: changes.instrumentType,
        risk: changes.risk,
        symbol: symbol || null,
        isActive: remota.isActive,
      }),
    );

    this.store.data.update((data) => ({
      ...data,
      investments: data.investments.map((investment) =>
        investment.id === id
          ? {
              ...investment,
              name,
              type: changes.instrumentType,
              risk: RIESGOS[changes.risk],
              symbol: symbol || undefined,
            }
          : investment,
      ),
    }));
    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.investment.updated', { name }));
  }

  async registerInvestmentOperation(id: string, input: OperacionDeInversion) {
    const dinero = (valor: number) => ({ amount: String(valor), currency: input.currency });
    await firstValueFrom(
      this.client.registerInvestmentOperation(id, {
        type: input.type,
        date: input.date,
        amount: dinero(input.amount),
        ...(input.account ? { account: input.account } : {}),
        ...(input.quantity !== undefined ? { quantity: String(input.quantity) } : {}),
        ...(input.unitPrice !== undefined ? { unitPrice: dinero(input.unitPrice) } : {}),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      }),
    );
    this.store.invalidarListadoDeMovimientos();
    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.investment.operationRegistered'));
  }

  async addInvestmentValuation(id: string, input: ValorizacionDeInversion) {
    await firstValueFrom(
      this.client.addInvestmentValuation(id, {
        date: input.date,
        value: { amount: String(input.value), currency: input.currency },
        source: input.source,
        ...(input.reference?.trim() ? { reference: input.reference.trim() } : {}),
      }),
    );
    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.investment.valuationAdded'));
  }

  investmentOperations(id: string) {
    return firstValueFrom(this.client.investmentOperations(id));
  }

  investmentValuations(id: string) {
    return firstValueFrom(this.client.investmentValuations(id));
  }
}
