import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../../core/i18n';
import { IconComponent } from '../../../../ui/icon/icon';
import { NumericInputDirective } from '../../../../ui/numeric-input/numeric-input.directive';
import { UiOption, UiSelectComponent } from '../../../../ui/select/select';

export type GoalKey = 'goalMin' | 'goalTarget' | 'goalMax';

@Component({
  selector: 'fin-widget-controls',
  imports: [HlmButton, HlmInput, FormsModule, IconComponent, UiSelectComponent, NumericInputDirective],
  templateUrl: './widget-controls.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  readonly typeOptions = input<readonly UiOption[]>([]);
  readonly dimensionOptions = input<readonly UiOption[]>([]);
  readonly measureOptions = input<readonly UiOption[]>([]);

  readonly showDimensionMeasure = input(false);
  readonly showSeries = input(false);
  readonly showGoal = input(false);

  readonly canReorder = input(false);
  readonly canChangeType = input(false);
  readonly canHide = input(false);

  @Output() readonly moveUp = new EventEmitter<void>();
  @Output() readonly moveDown = new EventEmitter<void>();
  @Output() readonly typeChange = new EventEmitter<string>();
  @Output() readonly dimensionChange = new EventEmitter<string>();
  @Output() readonly measureChange = new EventEmitter<string>();
  @Output() readonly dimension2Change = new EventEmitter<string>();
  @Output() readonly goalChange = new EventEmitter<{ key: GoalKey; value: string }>();
  @Output() readonly hide = new EventEmitter<void>();
}
