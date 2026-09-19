import { HlmButton } from '@spartan-ng/helm/button';
import { HlmResizableImports } from '@spartan-ng/helm/resizable';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { I18nService } from '../../../../core/i18n';
import { IconComponent, IconName } from '../../../../ui/icon/icon';
import { KpiComponent } from '../../../../ui/kpi/kpi';
import { LayoutRow, MIN_PANEL_SIZE } from '../../layout/dashboard-layout';

export interface KpiCardConfig {
  key?: string;
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

export interface KpiRowResize {
  key: string;
  sizes: readonly number[];
}

export const FIXED_KPI_PREFIX = 'fixed:';
export const CUSTOM_KPI_PREFIX = 'custom:';

@Component({
  selector: 'fin-kpi-strip',
  imports: [HlmButton, HlmResizableImports, KpiComponent, IconComponent],
  templateUrl: './kpi-strip.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiStripComponent {
  readonly i18n = inject(I18nService);
  readonly fixedKpis = input<readonly KpiCardConfig[]>([]);
  readonly customKpis = input<readonly CustomKpiCardConfig[]>([]);
  readonly rows = input<readonly LayoutRow[]>([]);
  readonly canRemove = input(false);
  readonly canCreate = input(false);
  readonly resizable = input(false);
  readonly minSize = MIN_PANEL_SIZE;

  readonly rowResize = output<KpiRowResize>();
  @Output() readonly removeKpi = new EventEmitter<string>();
  @Output() readonly openCreator = new EventEmitter<void>();

  private readonly cards = computed(() => {
    const map = new Map<string, { card: KpiCardConfig; customId: string | null }>();
    for (const kpi of this.fixedKpis())
      map.set(FIXED_KPI_PREFIX + (kpi.key ?? kpi.label), { card: kpi, customId: null });
    for (const kpi of this.customKpis()) map.set(CUSTOM_KPI_PREFIX + kpi.id, { card: kpi, customId: kpi.id });
    return map;
  });

  entry(id: string) {
    return this.cards().get(id) ?? null;
  }
}
