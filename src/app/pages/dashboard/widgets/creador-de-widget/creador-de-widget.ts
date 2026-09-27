import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { I18nService } from '@core/i18n';
import { CAPABILITIES } from '@core/state';
import { P } from '@core/session';
import { ChartComponent, ChartOption } from '@ui/chart';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { ConfiguradorVisualComponent, GaleriaVisualComponent, TIPOS_DEL_MOTOR, definicionDe } from '@shared/graficas';
import type { ConfiguracionVisual } from '@shared/graficas';
import { Dimension, Measure, TWO_DIMENSION_TYPES, Widget, WidgetType } from '@shared/tablero/dashboard.model';
import { esGenerico } from '@pages/dashboard/widgets/edicion-de-widgets';

function sinTipo(config: ConfiguracionVisual): Omit<ConfiguracionVisual, 'tipo'> {
  const { tipo, ...resto } = config;
  void tipo;
  return resto;
}

@Component({
  selector: 'fin-creador-de-widget',
  imports: [
    FormsModule,
    HlmButton,
    HlmInput,
    ChartComponent,
    FieldComponent,
    IconComponent,
    OverlayComponent,
    UiSelectComponent,
    ConfiguradorVisualComponent,
    GaleriaVisualComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './creador-de-widget.html',
})
export class CreadorDeWidgetComponent {
  readonly i18n = inject(I18nService);
  private readonly caps = inject(CAPABILITIES);

  readonly otherTypeOptions = input<readonly UiOption[]>([]);
  readonly dimensionOptions = input<readonly UiOption[]>([]);
  readonly measureOptions = input<readonly UiOption[]>([]);
  readonly opcionDe = input.required<(widget: Widget) => ChartOption>();
  readonly creado = output<Widget>();
  readonly cerrado = output<void>();

  newWidgetTitle = '';
  newWidgetWidth = 'wide';
  newWidgetDimension: Dimension = 'category';
  newWidgetDimension2: Dimension = 'kind';
  newWidgetMeasure: Measure = 'expense';
  newWidgetGoalMin = 0;
  newWidgetGoalTarget = 0;
  newWidgetGoalMax = 0;
  readonly nuevoVisual = signal<ConfiguracionVisual>({ tipo: 'bar', dimension: 'category', measure: 'expense' });
  readonly otroTipo = signal<WidgetType | ''>('');

  readonly widthOptions = computed<readonly UiOption[]>(() => [
    { value: 'wide', label: this.i18n.t('dashboard.widgetWidth.wide') },
    { value: 'half', label: this.i18n.t('dashboard.widgetWidth.half') },
  ]);

  readonly vistaPrevia = computed(() =>
    this.otroTipo()
      ? null
      : this.opcionDe()({
          id: 'vista-previa',
          title: '',
          kicker: '',
          type: this.nuevoVisual().tipo,
          wide: true,
          ...sinTipo(this.nuevoVisual()),
        }),
  );

  get newWidgetMetric(): WidgetType {
    return this.otroTipo() || this.nuevoVisual().tipo;
  }

  isGeneric(type: WidgetType): boolean {
    return esGenerico(type);
  }

  needsGoal(type: WidgetType): boolean {
    return type === 'indicator' || type === 'colorScale';
  }

  elegirTipoDelMotor(tipo: string): void {
    const definicion = definicionDe(tipo);
    if (!definicion) return;
    this.otroTipo.set('');
    this.newWidgetWidth = definicion.ancha ? 'wide' : 'half';
    this.nuevoVisual.update((actual) => ({
      ...actual,
      tipo: definicion.tipo,
      variant: undefined,
      dimension: definicion.sugerida.dimension,
      dimension2: definicion.sugerida.dimension2,
      measure: definicion.sugerida.measure ?? 'expense',
    }));
  }

  crear(event: Event): void {
    event.preventDefault();
    if (!this.caps.allows(P.dashboard.widget.crear)) return;
    const title = this.newWidgetTitle.trim();
    if (!title) return;
    const tipo = this.newWidgetMetric;
    this.creado.emit({
      id: `custom-${Date.now()}`,
      title,
      kicker: this.i18n.t('dashboard.widget.custom.kicker'),
      type: tipo,
      wide: this.newWidgetWidth === 'wide' && tipo !== 'indicator',
      ...(TIPOS_DEL_MOTOR.has(tipo) ? sinTipo(this.nuevoVisual()) : esGenerico(tipo) ? this.configGenerica(tipo) : {}),
    });
    this.newWidgetTitle = '';
    this.otroTipo.set('');
  }

  private configGenerica(tipo: WidgetType): Partial<Widget> {
    return {
      dimension: this.newWidgetDimension,
      measure: this.newWidgetMeasure,
      ...(TWO_DIMENSION_TYPES.includes(tipo) ? { dimension2: this.newWidgetDimension2 } : {}),
      ...(this.needsGoal(tipo)
        ? { goalMin: this.newWidgetGoalMin, goalTarget: this.newWidgetGoalTarget, goalMax: this.newWidgetGoalMax }
        : {}),
    };
  }
}
