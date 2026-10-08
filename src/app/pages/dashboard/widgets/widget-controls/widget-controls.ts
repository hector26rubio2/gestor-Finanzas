import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { IconComponent } from '@ui/icon';
import { NumericInputDirective } from '@ui/numeric-input';
import { UiOption, UiSelectComponent } from '@ui/select';

export type GoalKey = 'goalMin' | 'goalTarget' | 'goalMax';

@Component({
  selector: 'fin-widget-controls',
  imports: [HlmButton, HlmInput, FormsModule, IconComponent, UiSelectComponent, NumericInputDirective],
  templateUrl: './widget-controls.html',
  host: { style: 'display: contents' },
})
export class WidgetControlsComponent {
  readonly i18n = inject(I18nService);
  readonly type = input.required<string>();
  readonly dimension = input('category');
  readonly measure = input('expense');
  readonly dimension2 = input('kind');
  readonly goalMin = input(0);
  readonly goalTarget = input(0);
  readonly goalMax = input(0);
  readonly variant = input('');
  readonly granularity = input('');
  readonly variantOptions = input<readonly UiOption[]>([]);
  readonly granularityOptions = input<readonly UiOption[]>([]);
  readonly showGranularity = input(false);

  readonly typeOptions = input<readonly UiOption[]>([]);
  readonly dimensionOptions = input<readonly UiOption[]>([]);
  readonly measureOptions = input<readonly UiOption[]>([]);

  readonly showDimensionMeasure = input(false);
  readonly showSeries = input(false);
  readonly showGoal = input(false);

  readonly canReorder = input(false);
  readonly canChangeType = input(false);
  readonly canHide = input(false);

  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly typeChange = output<string>();
  readonly dimensionChange = output<string>();
  readonly measureChange = output<string>();
  readonly dimension2Change = output<string>();
  readonly variantChange = output<string>();
  readonly granularityChange = output<string>();
  readonly goalChange = output<{
    key: GoalKey;
    value: string;
  }>();
  readonly hide = output<void>();
}
