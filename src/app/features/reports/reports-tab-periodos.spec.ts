import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { Movement } from '@core/state';
import { addMonthsToIso, todayIso } from '@core/utils/dates';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { ReportsTabComponent } from './reports-tab';

const PROVEEDORES: Provider[] = [provideRouter([]) as unknown as Provider];

function primerDiaDeHaceMeses(meses: number): string {
  return addMonthsToIso(`${todayIso().slice(0, 7)}-01`, -meses);
}

function gasto(id: string, fecha: string, categoria: string, monto: number): Movement {
  return {
    id,
    date: fecha,
    description: id,
    accountId: 'a',
    category: categoria,
    kind: 'expense',
    effect: 'expense',
    amount: -monto,
    status: 'confirmed',
  } as Movement;
}

function ingreso(id: string, fecha: string, monto: number): Movement {
  return {
    id,
    date: fecha,
    description: id,
    accountId: 'a',
    category: 'Salario',
    kind: 'income',
    effect: 'income',
    amount: monto,
    status: 'confirmed',
  } as Movement;
}

const movimientos = (): Movement[] =>
  Array.from({ length: 12 }, (_, meses) => {
    const fecha = primerDiaDeHaceMeses(meses);
    return [gasto(`g${meses}`, fecha, meses < 3 ? 'Reciente' : 'Antigua', 1000), ingreso(`i${meses}`, fecha, 3000)];
  }).flat();

function montar() {
  const montado = pruebaRender(ReportsTabComponent, {
    session: sesionDe(),
    data: datosDe({ movements: movimientos() }),
    providers: PROVEEDORES,
  });
  montado.cambios();
  return montado.component;
}

describe('Reportes: cambiar el período actualiza todas las secciones', () => {
  it.each([3, 6, 12])('con %i meses la serie mensual tiene esos meses, hasta el actual', (meses) => {
    const componente = montar();

    componente.reportPeriod.set(String(meses));

    const serie = componente.reportSeries();
    expect(serie).toHaveLength(meses);
    expect(serie.at(-1)!.key).toBe(todayIso().slice(0, 7));
    expect(serie[0].key).toBe(primerDiaDeHaceMeses(meses - 1).slice(0, 7));
  });

  it.each([3, 6, 12])('con %i meses los totales suman solo lo que cae en el rango', (meses) => {
    const componente = montar();

    componente.reportPeriod.set(String(meses));

    expect(componente.reportExpenses()).toBe(1000 * meses);
    expect(componente.reportIncome()).toBe(3000 * meses);
    expect(componente.reportNet()).toBe(2000 * meses);
  });

  it('las categorías del período cambian con él: las antiguas solo entran al ampliarlo', () => {
    const componente = montar();

    componente.reportPeriod.set('3');
    expect(componente.reportCategories().map((c) => c.name)).toEqual(['Reciente']);

    componente.reportPeriod.set('6');
    expect(
      componente
        .reportCategories()
        .map((c) => [c.name, c.value, c.percent])
        .sort(),
    ).toEqual([
      ['Antigua', 3000, 50],
      ['Reciente', 3000, 50],
    ]);
  });

  it('la categoría principal sigue al período', () => {
    const componente = montar();

    componente.reportPeriod.set('3');
    expect(componente.topCategory()).toMatchObject({ name: 'Reciente', value: 3000 });

    componente.reportPeriod.set('12');
    expect(componente.topCategory()).toMatchObject({ name: 'Antigua', value: 9000 });
  });

  it('el gasto promedio divide solo entre los meses cerrados de cada período', () => {
    const componente = montar();

    for (const meses of ['3', '6', '12']) {
      componente.reportPeriod.set(meses);
      expect(componente.reportAverageExpense()).toBe(1000);
    }
  });

  it('cada mes de la serie trae su ingreso, gasto y neto', () => {
    const componente = montar();
    componente.reportPeriod.set('3');

    for (const mes of componente.reportSeries()) expect(mes).toMatchObject({ income: 3000, expense: 1000, net: 2000 });
  });

  it('los gráficos de ingresos, categorías y tendencia se reconstruyen con el período', () => {
    const componente = montar();
    const eje = (opcion: unknown) =>
      ((opcion as { xAxis?: { data?: string[] }; yAxis?: { data?: string[] } }).xAxis?.data ??
        (opcion as { yAxis?: { data?: string[] } }).yAxis?.data ??
        []) as string[];

    componente.reportPeriod.set('3');
    const corto = eje(componente.incomeExpenseOption());
    componente.reportPeriod.set('12');
    const largo = eje(componente.incomeExpenseOption());

    expect(corto).toHaveLength(3);
    expect(largo).toHaveLength(12);
    expect(componente.trendOption()).not.toEqual(undefined);
  });
});

describe('Reportes: hallazgos según el período', () => {
  function montarSoloAntiguos() {
    const montado = pruebaRender(ReportsTabComponent, {
      session: sesionDe(),
      data: datosDe({ movements: [gasto('viejo', primerDiaDeHaceMeses(5), 'Antigua', 2000)] }),
      providers: PROVEEDORES,
    });
    montado.cambios();
    return montado.component;
  }

  it('un período corto sin gastos dice que no hay gastos y ampliarlo los encuentra', () => {
    const componente = montarSoloAntiguos();

    componente.reportPeriod.set('3');
    expect(componente.insights()[0]).toBe(componente.i18n.t('reports.insights.noExpenses'));
    expect(componente.reportExpenses()).toBe(0);

    componente.reportPeriod.set('6');
    expect(componente.insights()[0]).not.toBe(componente.i18n.t('reports.insights.noExpenses'));
    expect(componente.reportExpenses()).toBe(2000);
  });

  it('siempre hay tres hallazgos: gasto variable, categoría que sube y categorías sin asignar', () => {
    const componente = montar();

    for (const meses of ['3', '6', '12']) {
      componente.reportPeriod.set(meses);
      expect(componente.insights()).toHaveLength(3);
    }
  });
});
