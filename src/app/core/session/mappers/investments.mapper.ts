import { ViewData, Investment } from '@core/state/view-model';
import { ApiInvestment } from '@core/api/api-client';
import { parseMoney } from '@core/utils/money';

const RIESGOS: Readonly<Record<number, NonNullable<Investment['risk']>>> = { 1: 'Bajo', 2: 'Medio', 3: 'Alto' };

export function toViewInvestment(investment: ApiInvestment): ViewData['investments'][number] {
  const units = Number(investment.quantity);
  return {
    id: investment.id,
    name: investment.name,
    type: investment.instrumentType,
    cost: parseMoney(investment.costBasis),
    value: parseMoney(investment.marketValue ?? investment.costBasis),
    currency: investment.currency,
    risk: RIESGOS[investment.risk ?? 0],
    institution: investment.institution ?? undefined,
    symbol: investment.symbol ?? undefined,
    units: Number.isFinite(units) ? units : 0,
    netContributions: investment.netContributions ? parseMoney(investment.netContributions) : 0,
    valuedAt: investment.latestValuation?.date,
    sinValoracion: investment.marketValue == null,
  };
}
