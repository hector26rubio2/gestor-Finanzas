import { Injectable, computed, inject } from '@angular/core';
import { I18nService } from '@core/i18n';
import type { UiOption } from '@ui/select';
import { GRUPOS_VISUALES, VISUALES, definicionDe } from './catalogo';
import type { Dimension, Granularidad, GrupoVisual, Measure, TipoVisual } from './modelo';

const DIMENSIONES: readonly Dimension[] = [
  'category',
  'account',
  'accountType',
  'date',
  'weekday',
  'monthOfYear',
  'kind',
  'flow',
  'person',
  'recurring',
  'installments',
  'currency',
  'amountRange',
];

const MEDIDAS: readonly Measure[] = ['expense', 'income', 'amount', 'net', 'count', 'average', 'max', 'median'];

const GRANULARIDADES: readonly Granularidad[] = ['day', 'week', 'month', 'quarter', 'year'];

export interface GrupoDeOpciones {
  readonly grupo: GrupoVisual;
  readonly label: string;
  readonly tipos: readonly { readonly tipo: TipoVisual; readonly label: string }[];
}

@Injectable({ providedIn: 'root' })
export class OpcionesDeGraficas {
  private readonly i18n = inject(I18nService);

  readonly grupos = computed<readonly GrupoDeOpciones[]>(() =>
    GRUPOS_VISUALES.map((grupo) => ({
      grupo,
      label: this.i18n.t(`charts.group.${grupo}`),
      tipos: VISUALES.filter((v) => v.grupo === grupo).map((v) => ({
        tipo: v.tipo,
        label: this.i18n.t(`charts.type.${v.tipo}`),
      })),
    })),
  );

  readonly tipos = computed<readonly UiOption[]>(() =>
    this.grupos().flatMap((grupo) =>
      grupo.tipos.map((tipo) => ({ value: tipo.tipo, label: tipo.label, description: grupo.label })),
    ),
  );

  readonly dimensiones = computed<readonly UiOption[]>(() =>
    DIMENSIONES.map((d) => ({ value: d, label: this.i18n.t(`dashboard.dimension.${d}`) })),
  );

  readonly medidas = computed<readonly UiOption[]>(() =>
    MEDIDAS.map((m) => ({ value: m, label: this.i18n.t(`dashboard.measure.${m}`) })),
  );

  readonly granularidades = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('charts.granularity.auto') },
    ...GRANULARIDADES.map((g) => ({ value: g, label: this.i18n.t(`charts.granularity.${g}`) })),
  ]);

  variantes(tipo: string): readonly UiOption[] {
    return (definicionDe(tipo)?.variantes ?? []).map((v) => ({ value: v, label: this.i18n.t(`charts.variant.${v}`) }));
  }

  etiquetaDeTipo(tipo: string): string {
    return definicionDe(tipo) ? this.i18n.t(`charts.type.${tipo}`) : tipo;
  }
}
