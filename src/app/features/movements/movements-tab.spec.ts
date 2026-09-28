import { describe, expect, it } from 'vitest';
import en from '@core/i18n/en';
import es from '@core/i18n/es';
import fr from '@core/i18n/fr';
import pt from '@core/i18n/pt';
import { movementsKpiHintKey, type MovementsKpi } from './movements-tab';

describe('pistas de los KPI de movimientos', () => {
  it('en modo API la pista dice que el dato es de la página cargada', () => {
    const kpis: MovementsKpi[] = ['income', 'expense', 'records', 'recurring', 'installments', 'topCategory'];
    for (const kpi of kpis) {
      expect(movementsKpiHintKey(kpi)).toBe(`movements.kpi.page.${kpi}.hint`);
    }
  });

  it('cada pista que puede mostrar la pestaña existe en los cuatro idiomas', () => {
    const claves = [
      'movements.kpi.selectionHint',
      'movements.kpi.records.hint',
      'movements.kpi.recurring.hint',
      'movements.kpi.installments.hint',
      'movements.kpi.topCategory.hint',
      'movements.kpi.page.income.hint',
      'movements.kpi.page.expense.hint',
      'movements.kpi.page.records.hint',
      'movements.kpi.page.recurring.hint',
      'movements.kpi.page.installments.hint',
      'movements.kpi.page.topCategory.hint',
    ];
    const catalogos: Record<string, string>[] = [es, en, fr, pt];
    for (const catalogo of catalogos) {
      for (const clave of claves) expect(catalogo[clave], `falta ${clave}`).toBeTruthy();
    }
  });
});
