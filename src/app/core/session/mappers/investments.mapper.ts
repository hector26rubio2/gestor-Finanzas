import { ViewData } from '@core/state/view-model';
import { ApiInvestment } from '@core/api/api-client';
import { parseMoney } from '@core/utils/money';

export function toViewInvestment(investment: ApiInvestment): ViewData['investments'][number] {
  return {
    id: investment.id,
    name: investment.name,
    type: investment.instrumentType,
    cost: parseMoney(investment.costBasis),
    value: parseMoney(investment.marketValue ?? investment.costBasis),
    currency: investment.currency,
  };
}
