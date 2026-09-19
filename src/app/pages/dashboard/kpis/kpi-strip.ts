import { HlmButton } from '@spartan-ng/helm/button';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n';
import { IconComponent, IconName } from '../../../ui/icon';
import { KpiComponent } from '../../../ui/kpi/kpi';

export interface KpiCardConfig {
  label: string;
  icon: IconName | '';
  tone: 'accent' | 'success' | 'danger';
  value: string;
  hint: string;
  series: readonly number[];
  delta: number | null;
  subirEsBueno: boolean;
}

export interface CustomKpiCardConfig extends KpiCardConfig {
  id: string;
}

/**
 * Franja de KPI del dashboard: los cuatro fijos, los propios y el botón de
 * crear uno nuevo. Antes vivía entera en dashboard.html; qué KPI están
 * concedidos ya lo decide el padre al armar `fixedKpis`, esto solo itera.
 */
@Component({
  selector: 'fin-kpi-strip',
  imports: [HlmButton, KpiComponent, IconComponent],
  templateUrl: './kpi-strip.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiStripComponent {
  readonly i18n = inject(I18nService);
  readonly fixedKpis = input<readonly KpiCardConfig[]>([]);
  readonly customKpis = input<readonly CustomKpiCardConfig[]>([]);
  readonly canRemove = input(false);
  readonly canCreate = input(false);

  @Output() readonly removeKpi = new EventEmitter<string>();
  @Output() readonly openCreator = new EventEmitter<void>();
}
