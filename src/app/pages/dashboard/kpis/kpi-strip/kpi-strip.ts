import { HlmButton } from '@spartan-ng/helm/button';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
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
import { FlowItem, KPI_MIN_COLS } from '../../layout/dashboard-layout';
import { FlowResize } from '../../layout/dashboard-layout.service';
import { FlowItemComponent } from '../../layout/flow-item/flow-item';

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

export interface KpiResize {
  id: string;
  change: FlowResize;
}

export interface KpiMove {
  id: string;
  direction: number;
}

export const FIXED_KPI_PREFIX = 'fixed:';
export const CUSTOM_KPI_PREFIX = 'custom:';

@Component({
  selector: 'fin-kpi-strip',
  imports: [HlmButton, CdkDropList, FlowItemComponent, KpiComponent, IconComponent],
  templateUrl: './kpi-strip.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiStripComponent {
  readonly i18n = inject(I18nService);
  readonly fixedKpis = input<readonly KpiCardConfig[]>([]);
  readonly customKpis = input<readonly CustomKpiCardConfig[]>([]);
  readonly flow = input<readonly FlowItem[]>([]);
  readonly canRemove = input(false);
  readonly canCreate = input(false);
  readonly resizable = input(false);
  readonly minCols = KPI_MIN_COLS;

  readonly resize = output<KpiResize>();
  readonly move = output<KpiMove>();
  readonly drop = output<{ from: number; to: number }>();
  @Output() readonly removeKpi = new EventEmitter<string>();
  @Output() readonly openCreator = new EventEmitter<void>();

  private readonly cards = computed(() => {
    const map = new Map<string, { card: KpiCardConfig; customId: string | null }>();
    for (const kpi of this.fixedKpis())
      map.set(FIXED_KPI_PREFIX + (kpi.key ?? kpi.label), { card: kpi, customId: null });
    for (const kpi of this.customKpis()) map.set(CUSTOM_KPI_PREFIX + kpi.id, { card: kpi, customId: kpi.id });
    return map;
  });

  dropped(event: CdkDragDrop<unknown>): void {
    this.drop.emit({ from: event.previousIndex, to: event.currentIndex });
  }

  entry(id: string) {
    return this.cards().get(id) ?? null;
  }
}
