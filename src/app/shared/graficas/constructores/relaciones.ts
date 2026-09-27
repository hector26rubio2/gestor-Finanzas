import type { ChartOption } from '@ui/chart';
import { agregar, enlaces, etiquetaDeDimension, sinPrefijo } from '../datos';
import { Pedido, dimension2De, dimensionDe, formatoDe, limiteDe, medidaDe } from '../entorno';
import { cifraCorta, colores, conAlfa, herramientas } from '../estilo';

export function sankey(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const red = enlaces(
    movs,
    dimensionDe(config, 'account'),
    dimension2De(config, 'category'),
    medidaDe(config),
    entorno.ctx,
    limiteDe(config, 30),
  );
  const vertical = config.variant === 'vertical';
  const paleta = colores(palette);
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { dataType: string; name: string; value: number; data: { source?: string; target?: string } }) =>
        p.dataType === 'edge'
          ? `${sinPrefijo(p.data.source ?? '')} → ${sinPrefijo(p.data.target ?? '')}<br/><b>${formato(p.value)}</b>`
          : `${sinPrefijo(p.name)}<br/><b>${formato(p.value)}</b>`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'sankey' as const,
        orient: vertical ? ('vertical' as const) : ('horizontal' as const),
        left: 8,
        right: vertical ? 8 : 110,
        top: 12,
        bottom: vertical ? 40 : 12,
        nodeGap: 10,
        nodeWidth: 14,
        draggable: true,
        emphasis: { focus: 'adjacency' as const },
        label: { color: palette.text, fontSize: 11, formatter: (p: { name: string }) => sinPrefijo(p.name) },
        lineStyle: { color: 'gradient' as const, curveness: 0.5, opacity: 0.35 },
        itemStyle: { borderWidth: 0, borderRadius: 3 },
        data: red.nodos.map((nombre, i) => ({ name: nombre, itemStyle: { color: paleta[i % paleta.length] } })),
        links: red.enlaces,
      },
    ],
  };
}

export function cuerdas(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const red = enlaces(
    movs,
    dimensionDe(config, 'account'),
    dimension2De(config, 'category'),
    medidaDe(config),
    entorno.ctx,
    limiteDe(config, 24),
  );
  const paleta = colores(palette);
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { dataType?: string; name: string; value: number; data: { source?: string; target?: string } }) =>
        p.dataType === 'edge'
          ? `${sinPrefijo(p.data.source ?? '')} ↔ ${sinPrefijo(p.data.target ?? '')}<br/><b>${formato(p.value)}</b>`
          : `${sinPrefijo(p.name)}`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'chord' as const,
        radius: ['70%', '78%'],
        center: ['50%', '52%'],
        padAngle: 2,
        minAngle: 4,
        clockwise: true,
        label: {
          show: true,
          color: palette.text,
          fontSize: 11,
          formatter: (p: { name: string }) => sinPrefijo(p.name),
        },
        lineStyle: { color: 'source' as const, opacity: 0.35 },
        emphasis: { focus: 'adjacency' as const },
        data: red.nodos.map((nombre, i) => ({ name: nombre, itemStyle: { color: paleta[i % paleta.length] } })),
        links: red.enlaces,
      },
    ],
  } as ChartOption;
}

export function grafo(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const red = enlaces(
    movs,
    dimensionDe(config, 'person'),
    dimension2De(config, 'category'),
    medidaDe(config),
    entorno.ctx,
    limiteDe(config, 40),
  );
  const pesos = new Map<string, number>();
  for (const e of red.enlaces) {
    pesos.set(e.source, (pesos.get(e.source) ?? 0) + e.value);
    pesos.set(e.target, (pesos.get(e.target) ?? 0) + e.value);
  }
  const mayor = Math.max(1, ...pesos.values());
  const circular = config.variant === 'circular';
  const paleta = colores(palette);
  return {
    color: paleta,
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: palette.muted },
      icon: 'circle',
      data: [entorno.ctx.t('charts.graph.origin'), entorno.ctx.t('charts.graph.target')],
    },
    tooltip: {
      formatter: (p: { dataType: string; name: string; value: number; data: { source?: string; target?: string } }) =>
        p.dataType === 'edge'
          ? `${sinPrefijo(p.data.source ?? '')} — ${sinPrefijo(p.data.target ?? '')}<br/><b>${formato(p.value)}</b>`
          : `${sinPrefijo(p.name)}<br/><b>${formato(pesos.get(p.name) ?? 0)}</b>`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'graph' as const,
        layout: circular ? ('circular' as const) : ('force' as const),
        circular: { rotateLabel: true },
        force: { repulsion: 220, edgeLength: [50, 140], gravity: 0.08 },
        roam: true,
        draggable: true,
        categories: [{ name: entorno.ctx.t('charts.graph.origin') }, { name: entorno.ctx.t('charts.graph.target') }],
        label: {
          show: true,
          position: 'right' as const,
          color: palette.text,
          fontSize: 11,
          formatter: (p: { name: string }) => sinPrefijo(p.name),
        },
        lineStyle: { color: 'source' as const, curveness: 0.25, opacity: 0.5 },
        emphasis: { focus: 'adjacency' as const, lineStyle: { width: 4 } },
        data: red.nodos.map((nombre) => ({
          name: nombre,
          category: nombre.startsWith('o|') ? 0 : 1,
          value: pesos.get(nombre) ?? 0,
          symbolSize: 12 + ((pesos.get(nombre) ?? 0) / mayor) * 34,
        })),
        links: red.enlaces.map((e) => ({ ...e, lineStyle: { width: 1 + (e.value / mayor) * 6 } })),
      },
    ],
  };
}

export function paralelas(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const ctx = entorno.ctx;
  const ejesCategoricos = (['category', 'account', 'kind'] as const).map((dim) => ({
    dim,
    valores: agregar(movs, dim, 'count', ctx)
      .slice(0, 12)
      .map((d) => d.label),
  }));
  const muestra = [...movs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, limiteDe(config, 250));
  const ejes = [
    ...ejesCategoricos.map((e, i) => ({
      dim: i,
      name: ctx.t(`dashboard.dimension.${e.dim}`),
      type: 'category' as const,
      data: e.valores,
    })),
    { dim: 3, name: ctx.t('charts.parallel.day'), type: 'value' as const, min: 1, max: 31 },
    { dim: 4, name: ctx.t('charts.parallel.amount'), type: 'value' as const, formato: true },
  ];
  const datos = muestra
    .map((m) => {
      const valores = ejesCategoricos.map((e) => etiquetaDeDimension(m, e.dim, ctx).label);
      return valores.every((valor, i) => ejesCategoricos[i].valores.includes(valor))
        ? {
            value: [...valores, Number(m.date.slice(8, 10)), Math.abs(m.amount)],
            lineStyle: { color: m.amount >= 0 ? palette.success : palette.danger },
          }
        : null;
    })
    .filter((fila) => fila !== null);
  return {
    parallelAxis: ejes.map(({ ...eje }) => ({
      ...Object.fromEntries(Object.entries(eje).filter(([clave]) => clave !== 'formato')),
      nameTextStyle: { color: palette.muted, fontSize: 11 },
      axisLine: { lineStyle: { color: palette.line } },
      axisLabel: { color: palette.muted, fontSize: 10, ...('formato' in eje ? { formatter: cifraCorta } : {}) },
    })),
    parallel: {
      left: 60,
      right: 80,
      top: 36,
      bottom: 24,
      parallelAxisDefault: { nameLocation: 'end' as const, nameGap: 12 },
    },
    tooltip: { trigger: 'item' as const },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'parallel' as const,
        smooth: true,
        lineStyle: { width: 1.2, opacity: 0.45 },
        emphasis: { lineStyle: { width: 3, opacity: 1, color: conAlfa(palette.accent, 1) } },
        data: datos,
      },
    ],
  };
}
