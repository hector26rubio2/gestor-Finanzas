import type { ChartOption } from '@ui/chart';
import { agregar, jerarquia } from '@shared/graficas/datos';
import { Pedido, dimension2De, dimensionDe, formatoDe, limiteDe, medidaDe } from '@shared/graficas/entorno';
import { colores, conAlfa, herramientas, leyenda } from '@shared/graficas/estilo';
import type { Nodo } from '@shared/graficas/modelo';

export function torta(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const datos = agregar(movs, dimensionDe(config), medidaDe(config), entorno.ctx).filter((d) => d.value > 0);
  const limite = limiteDe(config, 8);
  const principales = datos.slice(0, limite);
  const resto = datos.slice(limite).reduce((s, d) => s + d.value, 0);
  const porciones = [
    ...principales.map((d) => ({ name: d.label, value: d.value, id: d.label })),
    ...(resto > 0 ? [{ name: entorno.ctx.t('charts.others'), value: resto, id: '' }] : []),
  ];
  const variante = config.variant ?? 'donut';
  const total = porciones.reduce((s, p) => s + p.value, 0);
  const radios: Record<string, [string, string] | string> = {
    pie: '74%',
    donut: ['52%', '78%'],
    half: ['55%', '92%'],
    rose: ['18%', '80%'],
  };
  return {
    color: colores(palette),
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/><b>${formato(p.value)}</b> · ${p.percent}%`,
    },
    legend: leyenda(palette, { orient: 'vertical' as const, top: 'middle', right: 0, left: 'auto' }),
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'pie' as const,
        radius: radios[variante] ?? radios['donut'],
        center: variante === 'half' ? ['40%', '72%'] : ['38%', '50%'],
        startAngle: variante === 'half' ? 180 : 90,
        endAngle: variante === 'half' ? 360 : undefined,
        roseType: variante === 'rose' ? ('area' as const) : undefined,
        padAngle: variante === 'pie' ? 0 : 1.5,
        itemStyle: { borderColor: palette.surface, borderWidth: 2, borderRadius: variante === 'pie' ? 0 : 8 },
        label:
          variante === 'donut' || variante === 'half'
            ? {
                show: true,
                position: 'center' as const,
                formatter: () =>
                  `{valor|${formato(total)}}\n{pie|${entorno.ctx.t('dashboard.widget.donut.totalLabel')}}`,
                rich: {
                  valor: { color: palette.text, fontSize: 20, fontWeight: 700 },
                  pie: { color: palette.muted, fontSize: 12, padding: [6, 0, 0, 0] },
                },
              }
            : { color: palette.text, fontSize: 12 },
        labelLine: { lineStyle: { color: palette.line } },
        emphasis: { scaleSize: 8, itemStyle: { shadowBlur: 16, shadowColor: conAlfa(palette.text, 0.25) } },
        data: porciones,
      },
    ],
  };
}

const conColores = (nodos: readonly Nodo[], paleta: readonly string[]): unknown[] =>
  nodos.map((nodo, i) => ({
    ...nodo,
    itemStyle: { color: paleta[i % paleta.length] },
    ...(nodo.children ? { children: [...nodo.children] } : {}),
  }));

export function solar(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const arbol = jerarquia(
    movs,
    [dimensionDe(config), dimension2De(config, 'account')],
    medidaDe(config),
    entorno.ctx,
    limiteDe(config, 8),
  );
  const redondeado = config.variant === 'rounded';
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${formato(p.value)}</b>`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'sunburst' as const,
        radius: ['12%', '92%'],
        sort: undefined,
        emphasis: { focus: 'ancestor' as const },
        itemStyle: { borderColor: palette.surface, borderWidth: 2, borderRadius: redondeado ? 8 : 0 },
        label: { color: '#fff', fontSize: 11, minAngle: 12, rotate: 'radial' as const },
        levels: [
          {},
          { r0: '12%', r: '55%', label: { rotate: 'tangential' as const } },
          {
            r0: '56%',
            r: '92%',
            label: { position: 'outside' as const, color: palette.muted, padding: 2 },
            itemStyle: { opacity: 0.85 },
          },
        ],
        data: conColores(arbol, colores(palette)),
      },
    ],
  };
}

export function mapaDeArbol(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const anidado = (config.variant ?? 'nested') === 'nested';
  const dims = anidado ? [dimensionDe(config), dimension2De(config, 'account')] : [dimensionDe(config)];
  const arbol = jerarquia(movs, dims, medidaDe(config), entorno.ctx, limiteDe(config, 12));
  return {
    tooltip: {
      formatter: (p: { name: string; value: number; treePathInfo?: { name: string }[] }) =>
        `${
          (p.treePathInfo ?? [])
            .map((n) => n.name)
            .filter(Boolean)
            .join(' › ') || p.name
        }<br/><b>${formato(p.value)}</b>`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'treemap' as const,
        top: 4,
        left: 4,
        right: 4,
        bottom: anidado ? 26 : 4,
        roam: false,
        nodeClick: anidado ? ('zoomToNode' as const) : false,
        breadcrumb: {
          show: anidado,
          bottom: 0,
          itemStyle: { color: palette.surface, borderColor: palette.line, textStyle: { color: palette.text } },
        },
        label: { color: '#fff', fontSize: 12, formatter: '{b}' },
        upperLabel: { show: anidado, height: 22, color: '#fff' },
        itemStyle: { borderColor: palette.surface, gapWidth: 2, borderRadius: 6 },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 4 } },
          { itemStyle: { gapWidth: 2, borderColorSaturation: 0.6 }, colorSaturation: [0.35, 0.6] },
        ],
        data: conColores(arbol, colores(palette)),
      },
    ],
  };
}

export function arbol(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const variante = config.variant ?? 'horizontal';
  const hijos = jerarquia(
    movs,
    [dimensionDe(config), dimension2De(config, 'account')],
    medidaDe(config),
    entorno.ctx,
    limiteDe(config, 6),
  );
  const raiz = {
    name: entorno.titulo || entorno.ctx.t('charts.total'),
    value: hijos.reduce((s, n) => s + n.value, 0),
    children: hijos,
  };
  const radial = variante === 'radial';
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${formato(p.value)}</b>`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'tree' as const,
        data: [raiz],
        layout: radial ? ('radial' as const) : ('orthogonal' as const),
        orient: variante === 'vertical' ? ('TB' as const) : ('LR' as const),
        top: radial ? '12%' : '6%',
        bottom: radial ? '12%' : '6%',
        left: radial ? '12%' : '14%',
        right: radial ? '12%' : '22%',
        symbol: 'circle',
        symbolSize: (valor: number) => 8 + Math.min(18, (valor / Math.max(1, raiz.value)) * 40),
        initialTreeDepth: 2,
        roam: true,
        expandAndCollapse: true,
        edgeShape: 'curve' as const,
        lineStyle: { color: palette.line, width: 1.4, curveness: 0.5 },
        itemStyle: { color: palette.accent, borderColor: palette.surface },
        label: {
          color: palette.text,
          fontSize: 11,
          position: variante === 'vertical' ? ('top' as const) : ('left' as const),
        },
        leaves: {
          label: { position: variante === 'vertical' ? ('bottom' as const) : ('right' as const), color: palette.muted },
        },
        animationDurationUpdate: 600,
      },
    ],
  };
}
