import type { ChartOption, ChartPalette } from '@ui/chart';
import {
  cifraCorta,
  colores,
  conAlfa,
  degradado,
  ejeCategoria,
  ejeValor,
  herramientas,
  leyenda,
  zoomDeTiempo,
} from '@shared/graficas';
import type { Deuda, Palanca, Proyeccion } from './amortizacion';
import type { FlujoPorMes, ProyeccionDeInversion } from './escenarios';

export interface EntornoDeProyeccion {
  readonly palette: ChartPalette;
  readonly etiquetas: readonly string[];
  readonly dinero: (valor: number) => string;
  readonly t: (clave: string, params?: Record<string, string | number>) => string;
}

export function saldosEnElTiempo(
  base: Proyeccion,
  escenario: Proyeccion,
  palancas: readonly Palanca[],
  e: EntornoDeProyeccion,
): ChartOption {
  const paleta = colores(e.palette);
  const meses = new Set(palancas.filter((p) => p.tipo === 'abono').map((p) => p.mes));
  return {
    color: paleta,
    grid: { top: 40, right: 18, bottom: 40, left: 12, containLabel: true },
    legend: leyenda(e.palette),
    xAxis: ejeCategoria(e.palette, e.etiquetas, { boundaryGap: false }),
    yAxis: ejeValor(e.palette),
    tooltip: { trigger: 'axis' as const, valueFormatter: (v: unknown) => e.dinero(Number(v)) },
    dataZoom: zoomDeTiempo(e.palette, e.etiquetas.length, 24),
    toolbox: herramientas(e.palette, e.t('planning.sim.chart.balances')),
    series: [
      ...escenario.deudas.map((serie, i) => ({
        name: serie.nombre,
        type: 'line' as const,
        smooth: 0.2,
        showSymbol: false,
        stack: 'saldo',
        lineStyle: { width: 1.2 },
        areaStyle: { color: degradado(paleta[i % paleta.length], 0.45, 0.08) },
        emphasis: { focus: 'series' as const },
        data: [...serie.saldo],
      })),
      {
        name: e.t('planning.sim.series.baseTotal'),
        type: 'line' as const,
        showSymbol: false,
        lineStyle: { width: 2, type: 'dashed' as const, color: e.palette.muted },
        itemStyle: { color: e.palette.muted },
        data: [...base.saldoTotal],
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: e.palette.success, type: 'solid' as const },
          label: { color: e.palette.success, formatter: e.t('planning.sim.extraPayment') },
          data: [...meses].map((mes) => ({ xAxis: mes })),
        },
      },
    ],
  };
}

export function cuotasPorMes(escenario: Proyeccion, e: EntornoDeProyeccion): ChartOption {
  const suma = (seleccion: (i: number) => number) =>
    Array.from({ length: escenario.meses }, (_, i) => Math.round(seleccion(i)));
  const capital = suma((i) => escenario.deudas.reduce((s, d) => s + d.capital[i], 0));
  const interes = suma((i) => escenario.deudas.reduce((s, d) => s + d.interes[i], 0));
  const abonos = suma((i) => escenario.deudas.reduce((s, d) => s + d.abonos[i], 0));
  const barra = (nombre: string, datos: number[], color: string, arriba = false) => ({
    name: nombre,
    type: 'bar' as const,
    stack: 'cuota',
    barMaxWidth: 18,
    itemStyle: { color, borderRadius: arriba ? ([4, 4, 0, 0] as [number, number, number, number]) : 0 },
    emphasis: { focus: 'series' as const },
    data: datos,
  });
  return {
    grid: { top: 40, right: 18, bottom: 40, left: 12, containLabel: true },
    legend: leyenda(e.palette),
    xAxis: ejeCategoria(e.palette, e.etiquetas),
    yAxis: ejeValor(e.palette),
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      valueFormatter: (v: unknown) => e.dinero(Number(v)),
    },
    dataZoom: zoomDeTiempo(e.palette, e.etiquetas.length, 24),
    toolbox: herramientas(e.palette, e.t('planning.sim.chart.payments'), ['line', 'bar', 'stack']),
    series: [
      barra(e.t('planning.sim.series.principal'), capital, e.palette.accent),
      barra(e.t('planning.sim.series.interest'), interes, e.palette.danger),
      barra(e.t('planning.sim.series.extra'), abonos, e.palette.success, true),
    ],
  };
}

export function interesesComparados(base: Proyeccion, escenario: Proyeccion, e: EntornoDeProyeccion): ChartOption {
  const nombres = escenario.deudas.map((d) => d.nombre);
  const valorBase = (id: string) => base.deudas.find((d) => d.id === id)?.interesTotal ?? 0;
  return {
    grid: { top: 36, right: 30, bottom: 12, left: 12, containLabel: true },
    legend: leyenda(e.palette),
    xAxis: ejeValor(e.palette),
    yAxis: ejeCategoria(e.palette, nombres),
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      valueFormatter: (v: unknown) => e.dinero(Number(v)),
    },
    toolbox: herramientas(e.palette, e.t('planning.sim.chart.interest')),
    series: [
      {
        name: e.t('planning.sim.series.base'),
        type: 'bar' as const,
        barMaxWidth: 14,
        itemStyle: {
          color: conAlfa(e.palette.muted, 0.5),
          borderRadius: [0, 4, 4, 0] as [number, number, number, number],
        },
        data: escenario.deudas.map((d) => valorBase(d.id)),
      },
      {
        name: e.t('planning.sim.series.scenario'),
        type: 'bar' as const,
        barMaxWidth: 14,
        itemStyle: { color: e.palette.danger, borderRadius: [0, 4, 4, 0] as [number, number, number, number] },
        label: {
          show: true,
          position: 'right' as const,
          color: e.palette.muted,
          formatter: (p: { value: number }) => cifraCorta(p.value),
        },
        data: escenario.deudas.map((d) => d.interesTotal),
      },
    ],
  };
}

export function lineaDeTiempoDeDeudas(base: Proyeccion, escenario: Proyeccion, e: EntornoDeProyeccion): ChartOption {
  const nombres = escenario.deudas.map((d) => d.nombre);
  const fin = (mes: number | null) => (mes === null ? escenario.meses : mes + 1);
  const finBase = (id: string) => fin(base.deudas.find((d) => d.id === id)?.mesFinal ?? null);
  return {
    grid: { top: 36, right: 24, bottom: 30, left: 12, containLabel: true },
    legend: leyenda(e.palette),
    xAxis: ejeValor(e.palette, (v) => e.etiquetas[Math.min(e.etiquetas.length - 1, Math.max(0, Math.round(v)))] ?? '', {
      max: escenario.meses,
      interval: Math.max(1, Math.round(escenario.meses / 4)),
    }),
    yAxis: ejeCategoria(e.palette, nombres),
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (p: { seriesName: string; name: string; value: number; seriesIndex: number }[]) =>
        p
          .filter((x) => x.seriesIndex > 0)
          .map((x) => `${x.seriesName}: <b>${e.t('planning.sim.months', { count: x.value })}</b>`)
          .join('<br/>'),
    },
    toolbox: herramientas(e.palette, e.t('planning.sim.chart.timeline')),
    series: [
      {
        type: 'bar' as const,
        stack: 'inicio',
        silent: true,
        itemStyle: { color: 'transparent' },
        data: escenario.deudas.map((d) => d.inicio),
      },
      {
        name: e.t('planning.sim.series.base'),
        type: 'bar' as const,
        barGap: '-100%',
        barMaxWidth: 16,
        itemStyle: { color: conAlfa(e.palette.muted, 0.35), borderRadius: 8 },
        data: escenario.deudas.map((d) => finBase(d.id) - d.inicio),
        stack: 'base',
      },
      {
        name: e.t('planning.sim.series.scenario'),
        type: 'bar' as const,
        barMaxWidth: 10,
        stack: 'inicio',
        itemStyle: { color: e.palette.accent, borderRadius: 8 },
        data: escenario.deudas.map((d) => fin(d.mesFinal) - d.inicio),
      },
    ],
  };
}

export function mapaDeDeudas(deudas: readonly Deuda[], e: EntornoDeProyeccion): ChartOption {
  const mayor = Math.max(1, ...deudas.map((d) => d.saldo));
  const paleta = colores(e.palette);
  return {
    grid: { top: 24, right: 24, bottom: 36, left: 12, containLabel: true },
    xAxis: ejeValor(e.palette, (v) => String(v), {
      name: e.t('planning.sim.axis.installments'),
      nameLocation: 'middle' as const,
      nameGap: 24,
      nameTextStyle: { color: e.palette.muted },
    }),
    yAxis: ejeValor(e.palette, (v) => `${v}%`, {
      name: e.t('planning.sim.axis.monthlyRate'),
      nameTextStyle: { color: e.palette.muted },
    }),
    tooltip: {
      formatter: (p: { data: { name: string; value: [number, number, number] } }) =>
        `${p.data.name}<br/>${e.t('planning.sim.axis.installments')}: <b>${p.data.value[0]}</b><br/>${e.t('planning.sim.axis.monthlyRate')}: <b>${p.data.value[1]}%</b><br/>${e.t('planning.sim.field.balance')}: <b>${e.dinero(p.data.value[2])}</b>`,
    },
    toolbox: herramientas(e.palette, e.t('planning.sim.chart.map')),
    series: [
      {
        type: 'scatter' as const,
        symbolSize: (v: [number, number, number]) => 16 + Math.sqrt(v[2] / mayor) * 50,
        label: {
          show: true,
          color: e.palette.text,
          fontSize: 10,
          formatter: (p: { data: { name: string } }) => p.data.name,
        },
        data: deudas.map((d, i) => ({
          name: d.nombre,
          value: [d.cuotas, d.tasaMensual, d.saldo],
          itemStyle: { color: conAlfa(paleta[i % paleta.length], 0.75), borderColor: paleta[i % paleta.length] },
        })),
      },
    ],
  };
}

export function flujoYMeta(escenario: Proyeccion, meta: number, e: EntornoDeProyeccion): ChartOption {
  return {
    grid: { top: 40, right: 18, bottom: 40, left: 12, containLabel: true },
    legend: leyenda(e.palette),
    xAxis: ejeCategoria(e.palette, e.etiquetas),
    yAxis: ejeValor(e.palette),
    tooltip: { trigger: 'axis' as const, valueFormatter: (v: unknown) => e.dinero(Number(v)) },
    dataZoom: zoomDeTiempo(e.palette, e.etiquetas.length, 24),
    toolbox: herramientas(e.palette, e.t('planning.sim.chart.cashflow'), ['line', 'bar']),
    series: [
      {
        name: e.t('planning.sim.series.freeCash'),
        type: 'bar' as const,
        barMaxWidth: 14,
        itemStyle: {
          color: (p: { value: number }) =>
            p.value >= 0 ? conAlfa(e.palette.success, 0.7) : conAlfa(e.palette.danger, 0.7),
          borderRadius: 3,
        },
        data: [...escenario.flujoLibre],
      },
      {
        name: e.t('planning.sim.series.savings'),
        type: 'line' as const,
        smooth: 0.3,
        showSymbol: false,
        lineStyle: { width: 2.6, color: e.palette.accent },
        areaStyle: { color: degradado(e.palette.accent) },
        data: [...escenario.ahorroAcumulado],
        markLine:
          meta > 0
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: e.palette.warn, type: 'dashed' as const },
                label: { color: e.palette.warn, formatter: `${e.t('charts.goal')} ${cifraCorta(meta)}` },
                data: [{ yAxis: meta }],
              }
            : undefined,
        markPoint:
          escenario.mesDeMeta !== null
            ? {
                symbolSize: 44,
                itemStyle: { color: e.palette.warn },
                label: { fontSize: 10, color: '#fff', formatter: '★' },
                data: [{ coord: [escenario.mesDeMeta, escenario.ahorroAcumulado[escenario.mesDeMeta]] }],
              }
            : undefined,
      },
    ],
  };
}

export function crecimientoDeInversion(proyeccion: ProyeccionDeInversion, e: EntornoDeProyeccion): ChartOption {
  return {
    grid: { top: 40, right: 18, bottom: 40, left: 12, containLabel: true },
    legend: leyenda(e.palette),
    xAxis: ejeCategoria(e.palette, e.etiquetas, { boundaryGap: false }),
    yAxis: ejeValor(e.palette),
    tooltip: { trigger: 'axis' as const, valueFormatter: (v: unknown) => e.dinero(Number(v)) },
    dataZoom: zoomDeTiempo(e.palette, e.etiquetas.length, 24),
    toolbox: herramientas(e.palette, e.t('planning.sim.chart.investment'), ['line', 'bar']),
    series: [
      {
        name: e.t('planning.sim.series.contributed'),
        type: 'line' as const,
        showSymbol: false,
        lineStyle: { width: 2, type: 'dashed' as const, color: e.palette.muted },
        itemStyle: { color: e.palette.muted },
        data: proyeccion.puntos.map((p) => p.aportado),
      },
      {
        name: e.t('planning.sim.series.value'),
        type: 'line' as const,
        smooth: 0.3,
        showSymbol: false,
        lineStyle: { width: 2.6, color: e.palette.accent },
        itemStyle: { color: e.palette.accent },
        areaStyle: { color: degradado(e.palette.accent) },
        data: proyeccion.puntos.map((p) => p.valor),
      },
    ],
  };
}

export type VistaDeGrafica = 'original' | 'linea' | 'area' | 'barras' | 'apiladas';

type SerieDeGrafica = Record<string, unknown> & { type?: string };

export function conVista(opcion: ChartOption, vista: VistaDeGrafica): ChartOption {
  if (vista === 'original') return opcion;
  const series = (opcion as { series?: SerieDeGrafica[] }).series ?? [];
  const cambiable = (serie: SerieDeGrafica) => serie.type === 'line' || serie.type === 'bar';
  const transformar = (serie: SerieDeGrafica): SerieDeGrafica => {
    if (!cambiable(serie)) return serie;
    const resto: SerieDeGrafica = { ...serie };
    delete resto['areaStyle'];
    delete resto['stack'];
    delete resto['smooth'];
    switch (vista) {
      case 'linea':
        return { ...resto, type: 'line', smooth: 0.25, showSymbol: false };
      case 'area':
        return { ...resto, type: 'line', smooth: 0.25, showSymbol: false, areaStyle: { opacity: 0.25 } };
      case 'barras':
        return { ...resto, type: 'bar', barMaxWidth: 16 };
      default:
        return { ...resto, type: 'bar', barMaxWidth: 18, stack: 'total' };
    }
  };
  return { ...opcion, series: series.map(transformar) } as ChartOption;
}

export function mesAMes(escenario: Proyeccion, flujo: FlujoPorMes, e: EntornoDeProyeccion): ChartOption {
  const paleta = colores(e.palette);
  const meses = escenario.meses;
  const cuotas = escenario.cuotaTotal.slice(0, meses).map((v) => Math.round(v));
  const libre = escenario.flujoLibre.slice(0, meses);
  return {
    grid: { top: 48, right: 18, bottom: 40, left: 12, containLabel: true },
    legend: leyenda(e.palette, { type: 'scroll' }),
    xAxis: ejeCategoria(e.palette, e.etiquetas),
    yAxis: ejeValor(e.palette),
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      valueFormatter: (v: unknown) => e.dinero(Number(v)),
    },
    dataZoom: zoomDeTiempo(e.palette, e.etiquetas.length, 24),
    toolbox: herramientas(e.palette, e.t('planning.sim.chart.monthByMonth'), ['line', 'bar', 'stack']),
    series: [
      ...flujo.gastoPorLinea.map((linea, i) => ({
        name: linea.nombre,
        type: 'bar' as const,
        stack: 'gasto',
        barMaxWidth: 22,
        itemStyle: { color: conAlfa(paleta[(i + 2) % paleta.length], 0.8) },
        emphasis: { focus: 'series' as const },
        data: linea.valores.slice(0, meses).map((v) => Math.round(v)),
      })),
      {
        name: e.t('planning.sim.series.installments'),
        type: 'bar' as const,
        stack: 'gasto',
        barMaxWidth: 22,
        itemStyle: { color: e.palette.danger, borderRadius: [4, 4, 0, 0] as [number, number, number, number] },
        data: cuotas,
      },
      {
        name: e.t('planning.sim.series.income'),
        type: 'line' as const,
        showSymbol: false,
        lineStyle: { width: 2, color: e.palette.success },
        itemStyle: { color: e.palette.success },
        data: flujo.ingreso.slice(0, meses).map((v) => Math.round(v)),
      },
      {
        name: e.t('planning.sim.series.freeCash'),
        type: 'line' as const,
        showSymbol: false,
        lineStyle: { width: 2.4, type: 'dashed' as const, color: e.palette.accent },
        itemStyle: { color: e.palette.accent },
        data: libre,
      },
    ],
  };
}

export interface EscenarioGuardado {
  readonly id: string;
  readonly nombre: string;
  readonly saldoTotal: readonly number[];
  readonly ahorroAcumulado: readonly number[];
  readonly flujoLibre: readonly number[];
}

export type MedidaDeComparacion = 'saldoTotal' | 'ahorroAcumulado' | 'flujoLibre';

export function comparacionDeEscenarios(
  escenarios: readonly EscenarioGuardado[],
  medida: MedidaDeComparacion,
  e: EntornoDeProyeccion,
): ChartOption {
  const paleta = colores(e.palette);
  return {
    grid: { top: 44, right: 18, bottom: 40, left: 12, containLabel: true },
    legend: leyenda(e.palette, { type: 'scroll' }),
    xAxis: ejeCategoria(e.palette, e.etiquetas, { boundaryGap: false }),
    yAxis: ejeValor(e.palette),
    tooltip: { trigger: 'axis' as const, valueFormatter: (v: unknown) => e.dinero(Number(v)) },
    dataZoom: zoomDeTiempo(e.palette, e.etiquetas.length, 24),
    toolbox: herramientas(e.palette, e.t('planning.sim.chart.compare'), ['line', 'bar']),
    series: escenarios.map((escenario, i) => ({
      name: escenario.nombre,
      type: 'line' as const,
      smooth: 0.2,
      showSymbol: false,
      lineStyle: {
        width: i === 0 ? 2.6 : 1.8,
        type: i === 0 ? ('solid' as const) : ('dashed' as const),
        color: paleta[i % paleta.length],
      },
      itemStyle: { color: paleta[i % paleta.length] },
      data: escenario[medida].slice(0, e.etiquetas.length),
    })),
  };
}
