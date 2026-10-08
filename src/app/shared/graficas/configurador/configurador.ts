import { Component, computed, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmInput } from '@spartan-ng/helm/input';
import { I18nService } from '@core/i18n';
import { FieldComponent } from '@ui/field';
import { UiSelectComponent } from '@ui/select';
import { definicionDe } from '@shared/graficas/catalogo';
import type { ConfiguracionVisual } from '@shared/graficas/modelo';
import { OpcionesDeGraficas } from '@shared/graficas/opciones-de-graficas';
import { NumericInputDirective } from '@ui/numeric-input';

@Component({
  selector: 'fin-configurador-visual',
  imports: [NumericInputDirective, FormsModule, HlmInput, FieldComponent, UiSelectComponent],
  host: { class: 'grid grid-cols-2 gap-3 max-[520px]:grid-cols-1' },
  template: `
    @if (conTipo()) {
      <fin-field [label]="i18n.t('charts.picker.label')" [full]="true">
        <fin-select
          [ngModel]="config().tipo"
          (ngModelChange)="cambiar({ tipo: $event, variant: undefined })"
          [options]="opciones.tipos()"
          [ariaLabel]="i18n.t('charts.picker.label')"
        />
      </fin-field>
    }
    @if (definicion()?.dimensiones) {
      <fin-field [label]="i18n.t('dashboard.widgetForm.dimensionAxis')">
        <fin-select
          [ngModel]="config().dimension ?? 'category'"
          (ngModelChange)="cambiar({ dimension: $event })"
          [options]="opciones.dimensiones()"
          [ariaLabel]="i18n.t('dashboard.widgetActions.dimension.ariaLabel')"
        />
      </fin-field>
    }
    @if (definicion()?.dimensiones === 2) {
      <fin-field [label]="i18n.t('dashboard.widgetActions.series.ariaLabel')">
        <fin-select
          [ngModel]="config().dimension2 ?? 'kind'"
          (ngModelChange)="cambiar({ dimension2: $event })"
          [options]="opciones.dimensiones()"
          [ariaLabel]="i18n.t('dashboard.widgetForm.dimension2.ariaLabel')"
        />
      </fin-field>
    }
    @if (definicion()?.usaMedida) {
      <fin-field [label]="i18n.t('dashboard.widgetForm.measureValue')">
        <fin-select
          [ngModel]="config().measure ?? 'expense'"
          (ngModelChange)="cambiar({ measure: $event })"
          [options]="opciones.medidas()"
          [ariaLabel]="i18n.t('dashboard.widgetActions.measure.ariaLabel')"
        />
      </fin-field>
    }
    @if (variantes().length) {
      <fin-field [label]="i18n.t('charts.variant.label')">
        <fin-select
          [ngModel]="config().variant ?? variantes()[0].value"
          (ngModelChange)="cambiar({ variant: $event })"
          [options]="variantes()"
          [ariaLabel]="i18n.t('charts.variant.label')"
        />
      </fin-field>
    }
    <fin-field [label]="i18n.t('charts.granularity.label')">
      <fin-select
        [ngModel]="config().granularity ?? ''"
        (ngModelChange)="cambiar({ granularity: $event || undefined })"
        [options]="opciones.granularidades()"
        [ariaLabel]="i18n.t('charts.granularity.label')"
      />
    </fin-field>
    <fin-field [label]="i18n.t('charts.limit.label')">
      <input
        hlmInput
        type="number"
        min="3"
        max="60"
        step="1"
        [ngModel]="config().limit ?? ''"
        (ngModelChange)="cambiar({ limit: $event ? Number($event) : undefined })"
      />
    </fin-field>
  `,
})
export class ConfiguradorVisualComponent {
  readonly i18n = inject(I18nService);
  readonly opciones = inject(OpcionesDeGraficas);
  readonly config = model.required<ConfiguracionVisual>();
  readonly conTipo = input(true);
  readonly definicion = computed(() => definicionDe(this.config().tipo));
  readonly variantes = computed(() => this.opciones.variantes(this.config().tipo));
  readonly Number = Number;

  cambiar(cambios: Partial<ConfiguracionVisual>): void {
    this.config.update((actual) => ({ ...actual, ...cambios }));
  }
}
