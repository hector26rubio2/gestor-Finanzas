import { VISUALES } from '@shared/graficas/catalogo';
import type { ConfiguracionVisual } from '@shared/graficas/modelo';
import type { VistaDeReporte } from '@shared/tablero/dashboard-layout.service';
import { PRESETS_DE_PERIODO, type PresetDePeriodo, rangoDePreset } from './periodos';

export interface ReporteNormalizado {
  readonly preset: PresetDePeriodo;
  readonly desde: string;
  readonly hasta: string;
  readonly cuenta: string;
  readonly categoria: string;
  readonly flujo: 'all' | 'in' | 'out';
  readonly vistas: readonly VistaDeReporte[];
}

export interface ResultadoDeNormalizacion {
  readonly reporte: ReporteNormalizado | null;
  readonly reconocido: boolean;
}

const PRESET_POR_DEFECTO: PresetDePeriodo = 'last6';
const TIPOS_VALIDOS: ReadonlySet<string> = new Set(VISUALES.map((visual) => visual.tipo));
const FLUJOS = ['all', 'in', 'out'] as const;

const esFecha = (valor: unknown): valor is string => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
const esTexto = (valor: unknown, porDefecto: string): string => (typeof valor === 'string' ? valor : porDefecto);

function vistaValida(valor: unknown): VistaDeReporte | null {
  const vista = valor as Partial<VistaDeReporte> | null;
  const tipo = (vista?.config as Partial<ConfiguracionVisual> | undefined)?.tipo;
  if (!vista || typeof vista.id !== 'string' || typeof tipo !== 'string' || !TIPOS_VALIDOS.has(tipo)) return null;
  return {
    id: vista.id,
    title: esTexto(vista.title, ''),
    config: vista.config as ConfiguracionVisual,
    wide: vista.wide === true,
  };
}

export function normalizarReporte(json: string | null, hoy: string): ResultadoDeNormalizacion {
  if (!json) return { reporte: null, reconocido: true };
  let guardado: Record<string, unknown> | null = null;
  try {
    const crudo: unknown = JSON.parse(json);
    guardado = crudo && typeof crudo === 'object' ? (crudo as Record<string, unknown>) : null;
  } catch {
    guardado = null;
  }
  if (!guardado || guardado['version'] !== 1) return { reporte: null, reconocido: false };
  const preset = PRESETS_DE_PERIODO.find((p) => p === guardado['preset']) ?? PRESET_POR_DEFECTO;
  const porDefecto = rangoDePreset(PRESET_POR_DEFECTO, hoy);
  const desde = esFecha(guardado['desde']) ? guardado['desde'] : porDefecto.start;
  const hasta = esFecha(guardado['hasta']) ? guardado['hasta'] : porDefecto.end;
  const vistas = Array.isArray(guardado['vistas']) ? guardado['vistas'] : [];
  return {
    reconocido: true,
    reporte: {
      preset,
      desde: desde <= hasta ? desde : hasta,
      hasta: desde <= hasta ? hasta : desde,
      cuenta: esTexto(guardado['cuenta'], 'all'),
      categoria: esTexto(guardado['categoria'], 'all'),
      flujo: FLUJOS.find((f) => f === guardado['flujo']) ?? 'all',
      vistas: vistas.flatMap((v) => vistaValida(v) ?? []),
    },
  };
}
