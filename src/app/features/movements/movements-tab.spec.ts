import { describe, expect, it } from 'vitest';
import en from '@core/i18n/en';
import es from '@core/i18n/es';
import fr from '@core/i18n/fr';
import pt from '@core/i18n/pt';
import {
  columnasOcultasConDetalle,
  kpisDesplegadosDeEntrada,
  movementsKpiHintKey,
  type MovementsKpi,
} from './movements-tab';

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

describe('indicadores plegables de movimientos', () => {
  it('en teléfono y tableta arrancan plegados para que la lista se vea sin desplazar', () => {
    expect(kpisDesplegadosDeEntrada('compacto')).toBe(false);
    expect(kpisDesplegadosDeEntrada('medio')).toBe(false);
    expect(kpisDesplegadosDeEntrada('amplio')).toBe(false);
  });

  it('en escritorio arrancan desplegados y se pueden plegar', () => {
    expect(kpisDesplegadosDeEntrada('expandido')).toBe(true);
  });
});

describe('columnas de movimientos con el detalle acoplado', () => {
  const columnas = [
    { key: 'date', label: 'Fecha' },
    { key: 'account', label: 'Cuenta' },
    { key: 'currency', label: 'Moneda', prioridad: 2 as const },
  ];

  it('sin detalle acoplado no oculta ninguna', () => {
    expect(columnasOcultasConDetalle(columnas, false, 'expandido')).toEqual([]);
  });

  it('acoplado en tableta oculta la cuenta, que el detalle ya muestra', () => {
    expect(columnasOcultasConDetalle(columnas, true, 'amplio')).toEqual(['account']);
  });

  it('acoplado en escritorio oculta además las secundarias para que la tabla quepa', () => {
    expect(columnasOcultasConDetalle(columnas, true, 'expandido')).toEqual(['account', 'currency']);
  });
});
