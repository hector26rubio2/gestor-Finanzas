import type { I18nService } from '@core/i18n';
import type { Movement, AppStore } from '@core/state';
import type { ContextoDeDatos } from './datos';
import type { EntornoVisual } from './entorno';
import type { Granularidad } from './modelo';
import type { ChartPalette } from '@ui/chart';

export function etiquetaDeTipoDeMovimiento(m: Movement, i18n: I18nService): string {
  if (m.movementSubtype === 'transfer') return i18n.t('dashboard.movement.kind.transfer');
  if (m.movementSubtype === 'advance') return i18n.t('dashboard.movement.kind.advance');
  if (m.loanRole) return i18n.t('dashboard.movement.kind.loan');
  const etiquetas: Record<string, string> = {
    income: i18n.t('dashboard.movement.kind.income'),
    expense: i18n.t('dashboard.movement.kind.expense'),
    payment: i18n.t('dashboard.movement.kind.payment'),
  };
  return etiquetas[m.kind] ?? m.kind;
}

export function crearContextoDeDatos(store: AppStore, i18n: I18nService, granularidad: Granularidad): ContextoDeDatos {
  return {
    locale: store.preferences().locale,
    granularidad,
    t: (clave, params) => i18n.t(clave, params),
    nombreDeCuenta: (id) => store.account(id)?.name ?? i18n.t('dashboard.account.none'),
    tipoDeCuenta: (id) => i18n.t(`form.account.type.${store.account(id)?.type ?? 'other'}`),
    tipoDeMovimiento: (m) => etiquetaDeTipoDeMovimiento(m, i18n),
  };
}

export function crearEntorno(
  store: AppStore,
  i18n: I18nService,
  palette: ChartPalette,
  granularidad: Granularidad,
  titulo: string,
): EntornoVisual {
  return {
    palette,
    ctx: crearContextoDeDatos(store, i18n, granularidad),
    dinero: (valor) => store.money(valor),
    titulo,
  };
}

export function granularidadParaRango(desde: string, hasta: string): Granularidad {
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000;
  if (dias <= 45) return 'day';
  if (dias <= 120) return 'week';
  if (dias <= 800) return 'month';
  return 'quarter';
}
